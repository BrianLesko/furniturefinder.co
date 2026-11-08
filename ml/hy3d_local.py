"""
Local Hunyuan3D-2.1: image(s) -> shape -> PBR texture, on this machine's GPU.

    POST /build  {images: {angle: png}, out: glb path, textured?: bool, seed?: int}
                 -> {textured, stats}
    GET  /health -> {loaded: [...], busy: bool}

Runs in its own venv (ml/hy3d-venv) because the vendored code pins an older
diffusers/transformers than the rest of ml/. Models load on first use and are
dropped after IDLE_MINUTES without a request, so the ~29 GB is only held while
pieces are being built. One build at a time.

    hy3d-venv/bin/python hy3d_local.py [--port 6023]
"""

import argparse
import faulthandler
import json
import os
import signal
import shutil
import sys
import tempfile
import threading
import time
import traceback
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

HERE = Path(__file__).resolve().parent
ROOT = HERE.parent
VENDOR = HERE / "vendor" / "Hunyuan3D-2.1"
ALLOWED = [ROOT / "data" / "pieces", ROOT / "public" / "products", Path("/tmp")]
IDLE_MINUTES = float(os.environ.get("HY3D_IDLE_MINUTES", "10"))

# The same slots the hosted Space exposes; keep in step with hyspace.SLOTS.
SLOTS = {"front": "front", "back": "back", "side": "left", "other-side": "right"}
SHAPE_STEPS = 30
SHAPE_GUIDANCE = 5.0
OCTREE = 256
MAX_FACES = 40000
PAINT_VIEWS = 6
PAINT_RES = 512

sys.path.insert(0, str(VENDOR / "hy3dshape"))
sys.path.insert(0, str(VENDOR / "hy3dpaint"))
sys.path.insert(0, str(VENDOR))
os.chdir(VENDOR)  # the paint pipeline resolves its cfg/ckpt paths relative to the repo


def checked(path):
    p = Path(path).resolve()
    if not any(p.is_relative_to(a) for a in ALLOWED):
        raise ValueError(f"{path} is outside the allowed folders")
    return p


class Models:
    def __init__(self):
        self.lock = threading.Lock()
        self.shape = None
        self.paint = None
        self.face_reducer = None
        self.last_used = time.time()
        self.busy = False

    def load_shape(self):
        if self.shape is None:
            from hy3dshape.pipelines import Hunyuan3DDiTFlowMatchingPipeline
            from hy3dshape.postprocessors import FaceReducer

            t = time.time()
            self.shape = Hunyuan3DDiTFlowMatchingPipeline.from_pretrained("tencent/Hunyuan3D-2.1")
            self.face_reducer = FaceReducer()
            print(f"shape model loaded in {time.time() - t:.0f}s", flush=True)
        return self.shape

    def load_paint(self):
        if self.paint is None:
            try:
                from torchvision_fix import apply_fix

                apply_fix()
            except Exception as err:  # noqa: BLE001
                print(f"torchvision fix skipped: {err}", flush=True)
            from textureGenPipeline import Hunyuan3DPaintConfig, Hunyuan3DPaintPipeline

            t = time.time()
            conf = Hunyuan3DPaintConfig(PAINT_VIEWS, PAINT_RES)
            conf.realesrgan_ckpt_path = "hy3dpaint/ckpt/RealESRGAN_x4plus.pth"
            conf.multiview_cfg_path = "hy3dpaint/cfgs/hunyuan-paint-pbr.yaml"
            conf.custom_pipeline = "hy3dpaint/hunyuanpaintpbr"
            self.paint = Hunyuan3DPaintPipeline(conf)
            print(f"paint model loaded in {time.time() - t:.0f}s", flush=True)
        return self.paint

    def unload(self):
        import torch

        if self.shape is None and self.paint is None:
            return
        self.shape = self.paint = self.face_reducer = None
        import gc

        gc.collect()
        torch.cuda.empty_cache()
        print("models unloaded (idle)", flush=True)

    def loaded(self):
        return [n for n, m in (("shape", self.shape), ("paint", self.paint)) if m is not None]


MODELS = Models()


def idle_watch():
    while True:
        time.sleep(30)
        with MODELS.lock:
            if not MODELS.busy and time.time() - MODELS.last_used > IDLE_MINUTES * 60:
                MODELS.unload()


def build(images, out_glb, textured, seed):
    """images: {angle: path}. Writes out_glb; returns {textured, stats}."""
    import torch
    import trimesh
    from PIL import Image

    from hy3dshape.pipelines import export_to_trimesh

    stats = {}
    pil = {SLOTS[a]: Image.open(p).convert("RGBA") for a, p in images.items() if a in SLOTS}
    if "front" not in pil:
        raise ValueError("a front image is required")
    shape_input = pil if len(pil) > 1 else pil["front"]

    t = time.time()
    pipe = MODELS.load_shape()
    generator = torch.Generator().manual_seed(int(seed))
    outputs = pipe(
        image=shape_input,
        num_inference_steps=SHAPE_STEPS,
        guidance_scale=SHAPE_GUIDANCE,
        generator=generator,
        octree_resolution=OCTREE,
        num_chunks=8000,
        output_type="mesh",
    )
    mesh = export_to_trimesh(outputs)[0]
    mesh = MODELS.face_reducer(mesh, max_facenum=MAX_FACES)
    stats["faces"] = int(mesh.faces.shape[0])
    stats["shape_s"] = round(time.time() - t, 1)
    print(f"shape done: {stats['faces']} faces in {stats['shape_s']}s", flush=True)

    out_glb = Path(out_glb)
    out_glb.parent.mkdir(parents=True, exist_ok=True)
    if not textured:
        mesh.export(out_glb)
        return {"textured": False, "stats": stats}

    t = time.time()
    paint = MODELS.load_paint()
    work = Path(tempfile.mkdtemp(prefix="hy3d-"))
    try:
        white = work / "white_mesh.obj"
        mesh.export(white)
        textured_obj = str(work / "textured_mesh.obj")
        paint(mesh_path=str(white), image_path=pil["front"], output_mesh_path=textured_obj, save_glb=False)
        from convert_utils import create_glb_with_pbr_materials

        textures = {
            "albedo": textured_obj.replace(".obj", ".jpg"),
            "metallic": textured_obj.replace(".obj", "_metallic.jpg"),
            "roughness": textured_obj.replace(".obj", "_roughness.jpg"),
        }
        create_glb_with_pbr_materials(textured_obj, textures, str(out_glb))
    finally:
        shutil.rmtree(work, ignore_errors=True)
    stats["paint_s"] = round(time.time() - t, 1)
    print(f"paint done in {stats['paint_s']}s", flush=True)
    return {"textured": True, "stats": stats}


class Handler(BaseHTTPRequestHandler):
    def send(self, code, payload):
        body = json.dumps(payload).encode()
        self.send_response(code)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self):
        if self.path == "/health":
            return self.send(200, {"loaded": MODELS.loaded(), "busy": MODELS.busy})
        self.send(404, {"error": "not found"})

    def do_POST(self):
        if self.path != "/build":
            return self.send(404, {"error": "not found"})
        try:
            body = json.loads(self.rfile.read(int(self.headers.get("Content-Length", 0))) or b"{}")
            images = {a: checked(p) for a, p in body["images"].items()}
            out = checked(body["out"])
        except Exception as err:  # noqa: BLE001
            return self.send(400, {"error": str(err)})
        with MODELS.lock:
            MODELS.busy = True
            try:
                result = build(images, out, bool(body.get("textured")), body.get("seed", 1234))
                MODELS.last_used = time.time()
                return self.send(200, result)
            except Exception as err:  # noqa: BLE001
                traceback.print_exc()
                return self.send(500, {"error": str(err)[:500]})
            finally:
                MODELS.busy = False

    def log_message(self, fmt, *args):
        print(f"{self.address_string()} {fmt % args}", flush=True)


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--port", type=int, default=6023)
    ap.add_argument("--warm", action="store_true", help="load both models at start")
    args = ap.parse_args()
    faulthandler.register(signal.SIGUSR1, all_threads=True)  # kill -USR1 <pid> dumps every thread's stack
    if args.warm:
        MODELS.load_shape()
        MODELS.load_paint()
    threading.Thread(target=idle_watch, daemon=True).start()
    print(f"hy3d-local on 127.0.0.1:{args.port}", flush=True)
    ThreadingHTTPServer(("127.0.0.1", args.port), Handler).serve_forever()
