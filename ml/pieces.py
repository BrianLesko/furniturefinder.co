"""Local image service for adding catalog pieces.

Every request is JSON with file paths under data/pieces or public/products,
because the site and this service share one disk. Requests run one at a time.

    POST /matte      {src, out}                      cut a photo out with BiRefNet
    POST /rug        {src, kind, widthIn, lengthIn, outDir}
                                                     front, three-quarter and side of a flat rug
    POST /normalize  {slug, category, inches, views, outDir}
                                                     scale, pad, and write the published PNGs
    POST /fit        {src, out, maxPx}               shrink a cutout for the image-to-3D service
    POST /render     {glb, outDir, angles, altitudeDeg, inches, refs, up?, turn?}
                                                     photograph a 3D model from each view (render.py)
    POST /sheet-guide {panels, altitudeDeg, inches, out}
                                                     draw the layout for a view sheet (sheet.py)
    POST /sheet-split {sheet, panels, size, outDir}  cut a generated sheet into matted views
    POST /mesh-space  {images, out, textured?, token?}     build a 3D model on the Hunyuan3D-2.1 Space (hyspace.py)

    .venv/bin/python pieces.py [--port 6022]
"""

import argparse
import importlib.util
import json
import threading
import time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

import cv2
import numpy as np

ROOT = Path(__file__).resolve().parents[1]
ALLOWED = [ROOT / "data" / "pieces", ROOT / "public" / "products"]
MODEL = "ZhengPeng7/BiRefNet"
MATTE_SIZE = 1024
CONTENT_HEIGHT = 900
# Views written as flips of a shot view; keep in step with VIEWS in src/lib/views.js.
MIRRORS = {
    "three-quarter": "one-quarter",
    "front-side": "other-front-side",
    "side": "other-side",
    "back-side": "other-back-side",
    "back-three-quarter": "back-one-quarter",
}
AZIMUTHS = {
    "front": 0, "three-quarter": 45, "front-side": 67.5, "side": 90, "back-side": 112.5,
    "back-three-quarter": 135, "back": 180, "one-quarter": -45, "other-front-side": -67.5,
    "other-side": -90, "other-back-side": -112.5, "back-one-quarter": -135,
}
ALPHA_FLOOR = 8

# Rug views are a fixed camera over a flat rectangle, in inches.
RUG_CAMERA = {"distance": 230.0, "height": 140.0, "focal": 900.0}
RUG_VIEWS = {"front": 0, "three-quarter": 34, "front-side": 67.5, "side": 90}
RUG_PX_PER_IN = 12

_spec = importlib.util.spec_from_file_location("pad_product", ROOT / "scripts" / "pad-product.py")
pad_product = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(pad_product)

import hyspace  # noqa: E402
import render  # noqa: E402  (ml/render.py; sets up headless OpenGL on import)
import sheet  # noqa: E402

# Routes that wait on the network rather than the GPU run outside the lock.
UNLOCKED = {"/mesh-space"}


def checked(path):
    p = Path(path).resolve()
    if not any(p.is_relative_to(base) for base in ALLOWED):
        raise ValueError(f"{path} is outside data/pieces and public/products")
    return p


def read_rgba(path):
    image = cv2.imread(str(path), cv2.IMREAD_UNCHANGED)
    if image is None:
        raise ValueError(f"cannot read {path}")
    if image.ndim == 2:
        image = cv2.cvtColor(image, cv2.COLOR_GRAY2BGRA)
    elif image.shape[2] == 3:
        image = cv2.cvtColor(image, cv2.COLOR_BGR2BGRA)
    return image


def trim(rgba):
    ys, xs = np.nonzero(rgba[:, :, 3] > ALPHA_FLOOR)
    if not len(ys):
        raise ValueError("the cutout came out empty")
    return rgba[ys.min() : ys.max() + 1, xs.min() : xs.max() + 1]


def resize_rgba(rgba, size):
    """Resize in premultiplied alpha so edges do not pick up a dark halo."""
    f = rgba.astype(np.float32)
    f[:, :, :3] *= f[:, :, 3:4] / 255
    shrink = size[0] * size[1] < rgba.shape[0] * rgba.shape[1]
    out = cv2.resize(f, size, interpolation=cv2.INTER_AREA if shrink else cv2.INTER_CUBIC)
    a = np.clip(out[:, :, 3:4], 0, 255)
    rgb = np.where(a > 0.5, out[:, :, :3] * 255 / np.maximum(a, 0.5), 0)
    return np.dstack([np.clip(rgb, 0, 255), a]).astype(np.uint8)


class Matte:
    def __init__(self):
        import torch
        from transformers import AutoModelForImageSegmentation

        self.torch = torch
        self.device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
        dtype = torch.float16 if self.device.type == "cuda" else torch.float32
        self.dtype = dtype
        model = AutoModelForImageSegmentation.from_pretrained(MODEL, trust_remote_code=True)
        self.model = model.to(self.device, dtype).eval()

    def alpha(self, bgr):
        rgb = cv2.cvtColor(cv2.resize(bgr, (MATTE_SIZE, MATTE_SIZE), interpolation=cv2.INTER_AREA), cv2.COLOR_BGR2RGB)
        x = (rgb.astype(np.float32) / 255 - [0.485, 0.456, 0.406]) / [0.229, 0.224, 0.225]
        x = self.torch.from_numpy(x.transpose(2, 0, 1)[None].astype(np.float32)).to(self.device, self.dtype)
        with self.torch.no_grad():
            pred = self.model(x)[-1].sigmoid()[0, 0].float().cpu().numpy()
        a = cv2.resize(pred, (bgr.shape[1], bgr.shape[0]), interpolation=cv2.INTER_LINEAR)
        a = np.clip((a - 0.04) / 0.92, 0, 1)
        return a

    def cut(self, bgr):
        a = self.alpha(bgr)
        # Pull the background color out of soft edge pixels so they don't glow.
        bg = cv2.GaussianBlur(bgr.astype(np.float32) * (1 - a)[..., None], (0, 0), 12)
        bg = bg / np.maximum(cv2.GaussianBlur(1 - a, (0, 0), 12)[..., None], 1e-3)
        aa = a[..., None]
        fg = np.where(aa > 0.02, (bgr - (1 - aa) * bg) / np.maximum(aa, 0.02), 0)
        rgba = np.dstack([np.clip(fg, 0, 255), a * 255]).astype(np.uint8)
        return trim(rgba)


def rug_project(width_in, length_in, yaw):
    hw, hl = width_in / 2, length_in / 2
    local = np.array([[-hw, -hl], [hw, -hl], [hw, hl], [-hw, hl]], float)
    t = np.radians(yaw)
    x = local[:, 0] * np.cos(t) - local[:, 1] * np.sin(t)
    z = local[:, 0] * np.sin(t) + local[:, 1] * np.cos(t)
    d = RUG_CAMERA["distance"] + z
    return np.stack([RUG_CAMERA["focal"] * x / d, RUG_CAMERA["focal"] * RUG_CAMERA["height"] / d], 1)


def warp(src, src_quad, dst_quad, size):
    """Mipmapped inverse warp, so the far edge doesn't shimmer."""
    w, h = size
    pm = src.astype(np.float32)
    pm[:, :, :3] *= pm[:, :, 3:4] / 255
    M = cv2.getPerspectiveTransform(dst_quad.astype(np.float32), src_quad.astype(np.float32)).astype(np.float64)
    yy, xx = np.mgrid[0:h, 0:w].astype(np.float64)

    def at(x, y):
        d = M[2, 0] * x + M[2, 1] * y + M[2, 2]
        return (M[0, 0] * x + M[0, 1] * y + M[0, 2]) / d, (M[1, 0] * x + M[1, 1] * y + M[1, 2]) / d

    u, v = at(xx, yy)
    u1, v1 = at(xx + 1, yy)
    u2, v2 = at(xx, yy + 1)
    foot = np.maximum(np.hypot(u1 - u, v1 - v), np.hypot(u2 - u, v2 - v))
    mips = [pm]
    while min(mips[-1].shape[:2]) > 32:
        mips.append(cv2.pyrDown(mips[-1]))
    level = np.log2(np.clip(foot, 1, 2 ** (len(mips) - 1)))
    lo = np.floor(level).astype(int)
    t = level - lo
    acc = np.zeros((h, w, 4), np.float32)
    for i, mip in enumerate(mips):
        wt = np.where(lo == i, 1 - t, 0) + np.where(lo + 1 == i, t, 0)
        if not wt.any():
            continue
        sc = mip.shape[1] / pm.shape[1]
        sample = cv2.remap(mip, (u * sc).astype(np.float32), (v * sc).astype(np.float32), cv2.INTER_LINEAR,
                           borderMode=cv2.BORDER_CONSTANT, borderValue=(0, 0, 0, 0))
        acc += sample * wt[..., None].astype(np.float32)
    mask = np.zeros((h, w), np.uint8)
    cv2.fillConvexPoly(mask, np.round(dst_quad).astype(np.int32), 255)
    acc *= mask[..., None] > 0
    a = np.clip(acc[:, :, 3:4], 0, 255)
    rgb = np.where(a > 0.5, acc[:, :, :3] * 255 / np.maximum(a, 0.5), 0)
    return np.dstack([np.clip(rgb, 0, 255), a]).astype(np.uint8)


def quad_of(alpha):
    contours = cv2.findContours((alpha > 128).astype(np.uint8), cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_NONE)[0]
    hull = cv2.convexHull(max(contours, key=cv2.contourArea))
    approx = None
    for eps in np.linspace(0.005, 0.08, 60):
        approx = cv2.approxPolyDP(hull, eps * cv2.arcLength(hull, True), True)
        if len(approx) == 4:
            break
    if approx is None or len(approx) != 4:
        raise ValueError("could not find the rug's four corners")
    p = approx.reshape(4, 2).astype(np.float32)
    p = p[np.argsort(p[:, 1])]
    far, near = p[:2][np.argsort(p[:2, 0])], p[2:][np.argsort(p[2:, 0])]
    return np.array([near[0], near[1], far[1], far[0]], np.float32)


def rug_views(cutout, kind, width_in, length_in):
    """Flatten the rug photo to a top view, then render each fixed rug view."""
    tw, th = int(width_in * RUG_PX_PER_IN), int(length_in * RUG_PX_PER_IN)
    rect = np.float32([[0, th], [tw, th], [tw, 0], [0, 0]])
    quad = quad_of(cutout[:, :, 3])
    if kind == "top":
        # A top photo may be landscape; put its long side along the rug's length.
        sides = np.linalg.norm(quad[1] - quad[0]), np.linalg.norm(quad[2] - quad[1])
        if (sides[0] > sides[1]) != (width_in > length_in):
            quad = np.roll(quad, 1, axis=0)
    top = warp(cutout, quad, rect, (tw, th))
    projected = {angle: rug_project(width_in, length_in, yaw) for angle, yaw in RUG_VIEWS.items()}
    span = max(np.ptp(p, axis=0).max() for p in projected.values())
    scale = 1000 / span
    out = {}
    for angle, pts in projected.items():
        p = (pts - pts.min(0)) * scale
        size = (int(np.ceil(p[:, 0].max())) + 1, int(np.ceil(p[:, 1].max())) + 1)
        out[angle] = trim(warp(top, rect, p, size))
    return out


def stretch_target(view, inches, widths):
    """Width a generated view should have, from the piece's real size."""
    w, _, d = inches["width"], inches["height"], inches["depth"]
    angle = view["angle"]
    if angle == "front" or angle not in AZIMUTHS or not widths.get("front"):
        return None
    # Seen from azimuth a, a box spans W|cos a| + D|sin a| across the photo.
    a = np.radians(AZIMUTHS[angle])
    return widths["front"] * (w * abs(np.cos(a)) + d * abs(np.sin(a))) / w


def normalize(slug, category, inches, views, out_dir):
    """Scale every view to one content height, pad for the gallery, write PNGs."""
    out_dir = checked(out_dir)
    images = {}
    for view in views:
        rgba = trim(read_rgba(checked(view["path"])))
        if view.get("flip"):
            rgba = np.ascontiguousarray(rgba[:, ::-1])
        images[view["angle"]] = (view, rgba)
    if "front" not in images:
        raise ValueError("a piece needs a front view")
    rug = category == "rug"
    placed = {}
    if rug:
        # Rug views share one projection scale already; keep their sizes.
        placed = {angle: rgba for angle, (_, rgba) in images.items()}
    else:
        for angle, (view, rgba) in images.items():
            if angle == "top":
                continue
            scale = CONTENT_HEIGHT / rgba.shape[0]
            placed[angle] = resize_rgba(rgba, (max(1, round(rgba.shape[1] * scale)), CONTENT_HEIGHT))
        widths = {angle: img.shape[1] for angle, img in placed.items()}
        for angle, (view, rgba) in images.items():
            if angle not in placed or not view.get("generated") or view.get("trueShape"):
                continue  # real photos and 3D-shaped views already have the right proportions
            want = stretch_target(view, inches, widths)
            if want:
                k = min(1.3, max(0.7, want / placed[angle].shape[1]))
                placed[angle] = resize_rgba(placed[angle], (max(1, round(placed[angle].shape[1] * k)), CONTENT_HEIGHT))
        if "top" in images:
            top = images["top"][1]
            scale = CONTENT_HEIGHT / max(top.shape[:2])
            placed["top"] = resize_rgba(top, (max(1, round(top.shape[1] * scale)), max(1, round(top.shape[0] * scale))))
    gallery = [placed[a] for a in ("front", "three-quarter") if a in placed]
    pad_x, pad_y = pad_product.padding_for([(g.shape[1], g.shape[0]) for g in gallery])
    canvas_w = max(img.shape[1] for img in placed.values()) + 2 * pad_x
    canvas_h = max(img.shape[0] for img in placed.values()) + 2 * pad_y
    written = []
    for angle, img in placed.items():
        canvas = pad_product.center(img, canvas_w, canvas_h)
        path = out_dir / f"{slug}-{angle}.png"
        cv2.imwrite(str(path), canvas)
        written.append({"angle": angle, "path": str(path)})
        # Pieces whose sides differ send the far views as real shots.
        if angle in MIRRORS and MIRRORS[angle] not in images:
            mirror = out_dir / f"{slug}-{MIRRORS[angle]}.png"
            cv2.imwrite(str(mirror), np.ascontiguousarray(canvas[:, ::-1]))
            written.append({"angle": MIRRORS[angle], "path": str(mirror), "mirrorOf": angle})
    return {"canvas": [canvas_w, canvas_h], "written": written}


def make_handler(state):
    class Handler(BaseHTTPRequestHandler):
        def send(self, status, body):
            data = json.dumps(body).encode()
            self.send_response(status)
            self.send_header("Content-Type", "application/json")
            self.send_header("Content-Length", str(len(data)))
            self.end_headers()
            self.wfile.write(data)

        def do_GET(self):
            if self.path == "/health":
                return self.send(200, {"ok": True, "device": state["matte"].device.type})
            self.send(404, {"error": "Not found."})

        def do_POST(self):
            try:
                body = json.loads(self.rfile.read(int(self.headers.get("Content-Length") or 0)) or b"{}")
            except json.JSONDecodeError:
                return self.send(400, {"error": "Send JSON."})
            started = time.perf_counter()
            try:
                if self.path in UNLOCKED:
                    result = self.route(body)
                else:
                    with state["lock"]:
                        result = self.route(body)
            except (ValueError, KeyError) as err:
                return self.send(400, {"error": str(err)})
            except Exception as err:  # noqa: BLE001
                return self.send(500, {"error": f"{type(err).__name__}: {err}"})
            if result is None:
                return self.send(404, {"error": "Not found."})
            result["ms"] = round((time.perf_counter() - started) * 1000)
            self.send(200, result)

        def route(self, body):
            if self.path == "/matte":
                bgr = cv2.imread(str(checked(body["src"])), cv2.IMREAD_COLOR)
                if bgr is None:
                    raise ValueError("that file is not an image this service can read")
                rgba = state["matte"].cut(bgr)
                out = checked(body["out"])
                out.parent.mkdir(parents=True, exist_ok=True)
                cv2.imwrite(str(out), rgba)
                return {"out": str(out), "width": rgba.shape[1], "height": rgba.shape[0]}
            if self.path == "/rug":
                cutout = read_rgba(checked(body["src"]))
                views = rug_views(cutout, body.get("kind", "top"), float(body["widthIn"]), float(body["lengthIn"]))
                out_dir = checked(body["outDir"])
                out_dir.mkdir(parents=True, exist_ok=True)
                written = {}
                for angle, img in views.items():
                    path = out_dir / f"rug-{angle}.png"
                    cv2.imwrite(str(path), img)
                    written[angle] = str(path)
                return {"views": written}
            if self.path == "/normalize":
                return normalize(body["slug"], body["category"], body["inches"], body["views"], body["outDir"])
            if self.path == "/fit":
                rgba = trim(read_rgba(checked(body["src"])))
                if body.get("flip"):
                    rgba = np.ascontiguousarray(rgba[:, ::-1])
                max_px = int(body.get("maxPx") or 1536)
                k = min(1.0, max_px / max(rgba.shape[:2]))
                if k < 1:
                    rgba = resize_rgba(rgba, (max(1, round(rgba.shape[1] * k)), max(1, round(rgba.shape[0] * k))))
                pad = round(max(rgba.shape[:2]) * 0.06)
                rgba = cv2.copyMakeBorder(rgba, pad, pad, pad, pad, cv2.BORDER_CONSTANT, value=(0, 0, 0, 0))
                out = checked(body["out"])
                out.parent.mkdir(parents=True, exist_ok=True)
                cv2.imwrite(str(out), rgba)
                return {"out": str(out), "width": rgba.shape[1], "height": rgba.shape[0]}
            if self.path == "/render":
                out_dir = checked(body["outDir"])
                out_dir.mkdir(parents=True, exist_ok=True)
                refs = [{**ref, "path": str(checked(ref["path"]))} for ref in body.get("refs", [])]
                return render.render_views(
                    checked(body["glb"]),
                    out_dir,
                    list(body["angles"]),
                    AZIMUTHS,
                    float(body.get("altitudeDeg") or 10),
                    body["inches"],
                    refs,
                    up=body.get("up"),
                    turn=body.get("turn"),
                )
            if self.path == "/sheet-guide":
                out = checked(body["out"])
                out.parent.mkdir(parents=True, exist_ok=True)
                return sheet.guide(body["panels"], float(body.get("altitudeDeg") or 10), body["inches"], out)
            if self.path == "/sheet-split":
                out_dir = checked(body["outDir"])
                out_dir.mkdir(parents=True, exist_ok=True)
                return sheet.split(checked(body["sheet"]), body["panels"], body["size"], state["matte"], out_dir)
            if self.path == "/mesh-space":
                images = {angle: checked(p) for angle, p in body["images"].items()}
                out = checked(body["out"])
                token = body.get("token") or None
                note = None
                if body.get("textured"):
                    try:
                        return {**hyspace.build(images, out, textured=True, token=token), "note": None}
                    except Exception as err:  # noqa: BLE001  fall back to the shape alone
                        note = hyspace.friendly(err)
                try:
                    return {**hyspace.build(images, out, textured=False, token=token), "note": note}
                except Exception as err:  # noqa: BLE001
                    raise ValueError(hyspace.friendly(err)) from err
            return None

        def log_message(self, fmt, *args):
            print(f"{self.address_string()} {fmt % args}", flush=True)

    return Handler


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--host", default="127.0.0.1")
    parser.add_argument("--port", type=int, default=6022)
    args = parser.parse_args()
    state = {"matte": Matte(), "lock": threading.Lock()}
    server = ThreadingHTTPServer((args.host, args.port), make_handler(state))
    print(f"pieces service on http://{args.host}:{args.port} ({state['matte'].device.type})", flush=True)
    server.serve_forever()


if __name__ == "__main__":
    main()
