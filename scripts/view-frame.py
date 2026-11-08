"""Frame every view of a piece on one shared scale.

The piece's box is projected at an azimuth and altitude, in inches, with
the same pixels per inch and the same floor row for every angle. `guide`
draws that bounding box and a clay model inside it: the reference for
image generation, so the sofa comes back the size of the box. `fit` scales
a cutout so its opaque box is exactly as tall as that projection and sits
on it. A front view stays short and wide; a steep side view stays tall.
"""

import argparse
import json
import math
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw

# KIVIK, the piece this pipeline was first aimed at. Override per piece.
WIDTH_IN = 89.75
DEPTH_IN = 37.375
HEIGHT_IN = 32.625
PX_PER_IN = 8
CANVAS = (1500, 1200)
ORIGIN = (750, 780)  # image pixel of the box center on the floor

# Clay blocks: (u0, u1, v0, v1, h0, h1). u is right, v is toward the front.
ARM_IN, SEAT_IN, BACK_IN, ARM_H_IN = 11.0, 17.5, 9.0, 24.0


def project(azimuth, altitude, u, v, h):
    """x to the right, y down the image, depth toward the camera."""
    a, b = math.radians(azimuth), math.radians(altitude)
    x = u * math.cos(a) - v * math.sin(a)
    toward = u * math.sin(a) + v * math.cos(a)
    y = toward * math.sin(b) - h * math.cos(b)
    depth = toward * math.cos(b) + h * math.sin(b)
    return x, y, depth


def box_corners(azimuth, altitude, width, depth, height):
    w, d = width / 2, depth / 2
    return [project(azimuth, altitude, u, v, h) for h in (0, height) for u, v in ((-w, -d), (w, -d), (w, d), (-w, d))]


def to_px(x, y):
    return ORIGIN[0] + x * PX_PER_IN, ORIGIN[1] + y * PX_PER_IN


def frame(azimuth, altitude, width, depth, height):
    pts = [to_px(x, y) for x, y, _ in box_corners(azimuth, altitude, width, depth, height)]
    xs = [p[0] for p in pts]
    ys = [p[1] for p in pts]
    rect = (int(math.floor(min(xs))), int(math.floor(min(ys))), int(math.ceil(max(xs))), int(math.ceil(max(ys))))
    return rect


def clay_blocks(width, depth, height):
    w, d = width / 2, depth / 2
    return [
        (-w, w, -d, d, 0, SEAT_IN),
        (-w, -w + ARM_IN, -d, d, 0, ARM_H_IN),
        (w - ARM_IN, w, -d, d, 0, ARM_H_IN),
        (-w + ARM_IN, w - ARM_IN, -d, -d + BACK_IN, 0, height),
    ]


def guide_image(azimuth, altitude, width, depth, height):
    rect = frame(azimuth, altitude, width, depth, height)
    image = Image.new("RGB", CANVAS, "white")
    draw = ImageDraw.Draw(image)
    faces = []
    quads = {
        "bottom": [0, 1, 2, 3],
        "top": [4, 5, 6, 7],
        "back": [1, 0, 4, 5],
        "front": [3, 2, 6, 7],
        "left": [0, 3, 7, 4],
        "right": [2, 1, 5, 6],
    }
    normals = {"top": (0, 0, 1), "bottom": (0, 0, -1), "back": (0, -1, 0), "front": (0, 1, 0), "left": (-1, 0, 0), "right": (1, 0, 0)}
    shade = {"top": 214, "front": 150, "back": 150, "left": 120, "right": 120, "bottom": 90}
    for u0, u1, v0, v1, h0, h1 in clay_blocks(width, depth, height):
        corners = [(u, v, h) for h in (h0, h1) for (u, v) in ((u0, v0), (u1, v0), (u1, v1), (u0, v1))]
        for name, quad in quads.items():
            nu, nv, nh = normals[name]
            if project(azimuth, altitude, nu, nv, nh)[2] <= 1e-6:
                continue
            poly = [to_px(*project(azimuth, altitude, *corners[i])[:2]) for i in quad]
            depth_key = sum(project(azimuth, altitude, *corners[i])[2] for i in quad) / 4
            faces.append((depth_key, poly, shade[name]))
    for _, poly, tone in sorted(faces, key=lambda face: face[0]):
        draw.polygon(poly, fill=(tone, tone, tone), outline=(70, 70, 70))
    if rect[0] < 0 or rect[1] < 0 or rect[2] > CANVAS[0] or rect[3] > CANVAS[1]:
        raise SystemExit(f"projected box {rect} falls outside the canvas {CANVAS}")
    draw.rectangle(rect, outline=(255, 0, 180), width=3)
    return image, rect


def opaque_box(image):
    alpha = np.array(image)[:, :, 3]
    ys, xs = np.where(alpha > 16)
    if len(xs) == 0:
        raise SystemExit("cutout has no opaque pixels")
    return int(xs.min()), int(ys.min()), int(xs.max()) + 1, int(ys.max()) + 1


def fit_cutout(cutout, rect):
    x0, y0, x1, y1 = opaque_box(cutout)
    crop = cutout.crop((x0, y0, x1, y1))
    target_h = max(1, rect[3] - rect[1])
    scale = target_h / crop.size[1]
    size = (max(1, round(crop.size[0] * scale)), target_h)
    crop = crop.resize(size, Image.Resampling.LANCZOS)
    page = Image.new("RGBA", CANVAS, (0, 0, 0, 0))
    cx = (rect[0] + rect[2]) / 2
    cy = (rect[1] + rect[3]) / 2
    page.paste(crop, (int(round(cx - size[0] / 2)), int(round(cy - size[1] / 2))), crop)
    return page


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("command", choices=("guide", "fit"))
    parser.add_argument("--azimuth", type=float, required=True)
    parser.add_argument("--altitude", type=float, required=True)
    parser.add_argument("--width", type=float, default=WIDTH_IN)
    parser.add_argument("--depth", type=float, default=DEPTH_IN)
    parser.add_argument("--height", type=float, default=HEIGHT_IN)
    parser.add_argument("--out", type=Path, required=True)
    parser.add_argument("--cutout", type=Path)
    args = parser.parse_args()
    rect = frame(args.azimuth, args.altitude, args.width, args.depth, args.height)
    if args.command == "guide":
        image, rect = guide_image(args.azimuth, args.altitude, args.width, args.depth, args.height)
        image.save(args.out)
        args.out.with_suffix(".json").write_text(json.dumps({"rect": rect, "azimuth": args.azimuth, "altitude": args.altitude}))
    else:
        if not args.cutout:
            raise SystemExit("fit needs --cutout")
        fit_cutout(Image.open(args.cutout).convert("RGBA"), rect).save(args.out)
    print(args.command, args.out, rect)


if __name__ == "__main__":
    main()
