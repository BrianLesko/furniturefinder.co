"""Build a 3D model with the free Hunyuan3D-2.1 Space on Hugging Face.

The Space runs on ZeroGPU. Shape only (a white mesh) takes about 20 seconds
of GPU and fits any quota, even anonymous. Shape plus texture reserves about
270 seconds, which needs a logged-in account with enough quota (PRO gives 40
minutes a day). Set HF_TOKEN to use an account.
"""

import os
import re
import shutil
import tempfile
from pathlib import Path

SPACE = os.environ.get("HUNYUAN_SPACE", "tencent/Hunyuan3D-2.1")
# Our view names for the Space's multi-view slots. Its left and right are the piece's.
SLOTS = {"front": "image", "back": "mv_image_back", "side": "mv_image_left", "other-side": "mv_image_right"}


def build(images, out_glb, textured=False, token=None, steps=30, octree_resolution=256, seed=1234):
    """images: {angle: png path}. Writes the GLB to out_glb; returns {textured, stats}."""
    from gradio_client import Client, handle_file

    if "front" not in images:
        raise ValueError("a 3D model needs a real front photo")
    tmp = Path(tempfile.mkdtemp(prefix="hy-"))
    try:
        client = Client(SPACE, token=token or os.environ.get("HF_TOKEN") or None, download_files=str(tmp), verbose=False)
        args = {SLOTS[a]: handle_file(str(p)) for a, p in images.items() if a in SLOTS}
        if len(args) > 1:
            # Multi-view mode wants the front in its own slot too.
            args["mv_image_front"] = handle_file(str(images["front"]))
        common = dict(steps=steps, guidance_scale=5.0, seed=seed, octree_resolution=octree_resolution, check_box_rembg=False, num_chunks=8000, randomize_seed=False)
        if textured:
            result = client.predict(**args, **common, api_name="/generation_all")
            # white mesh, textured mesh, html, stats, seed
            picked, stats = result[1], result[3]
        else:
            result = client.predict(**args, **common, api_name="/shape_generation")
            picked, stats = result[0], result[2]
        path = picked["value"] if isinstance(picked, dict) else picked
        if not path or not Path(path).exists():
            raise ValueError("the Space returned no model file")
        out_glb = Path(out_glb)
        out_glb.parent.mkdir(parents=True, exist_ok=True)
        shutil.copyfile(path, out_glb)
        return {"textured": textured, "stats": stats}
    finally:
        shutil.rmtree(tmp, ignore_errors=True)


def friendly(err):
    """Turn the Space's errors into something the add page can show."""
    text = str(err)
    if "GPU duration" in text and "larger than the maximum" in text:
        return "The free Hunyuan3D Space will not texture a model without an account; it built the shape instead. Set HF_TOKEN to use the account's daily quota."
    if "quota" in text.lower() or "exceeded" in text.lower():
        m = re.search(r"(\d+)s requested vs\. (\d+)s left\)\. Try again in (\d+):(\d\d):\d\d", text)
        detail = f" Texturing reserves {m[1]} s of GPU and {m[2]} s are left today; the quota resets in {int(m[3])} h {int(m[4])} min." if m else ""
        return "The Hunyuan3D Space's daily GPU quota is short, so it built the shape only." + detail
    return f"The Hunyuan3D Space said: {text[:300]}"
