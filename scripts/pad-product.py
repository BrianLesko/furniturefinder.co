"""Pad a product's cutouts so the gallery shows the same minimum margin.

The pick card gallery is 16rem tall and as wide as the card. On a two-column
row that is about 530px by 256px (aspect 2.07) at the 1120px layout, and about
354px by 256px (aspect 1.38) when the row first becomes two columns. The image
is object-fit: contain on a white ground, so letterboxing is white space too.

Front and three-quarter must already be transparent and the same content
height. This writes those two, centered on one shared canvas, and writes the
one-quarter as a horizontal flip of the three-quarter. It adds the least
padding that leaves 9% of the card empty on every side at both aspects.
"""

import argparse
import math
import sys
from pathlib import Path

import cv2
import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
PHOTO_DIR = ROOT / "public" / "products"
GALLERY_ASPECTS = (2.070, 1.383)
MIN_MARGIN = 0.09
ALPHA_THRESHOLD = 16


def gaps(canvas_w, canvas_h, content_w, content_h, gallery_aspect):
    aspect = canvas_w / canvas_h
    if aspect >= gallery_aspect:
        image_height = gallery_aspect / aspect
        side = ((canvas_w - content_w) / 2) / canvas_w
        top = (1 - image_height) / 2 + ((canvas_h - content_h) / 2 / canvas_h) * image_height
    else:
        image_width = aspect / gallery_aspect
        top = ((canvas_h - content_h) / 2) / canvas_h
        side = (1 - image_width) / 2 + ((canvas_w - content_w) / 2 / canvas_w) * image_width
    return side, top


def padding_for(views, margin=MIN_MARGIN):
    """Least padding so every view clears `margin` on both gallery aspects.

    `views` is a list of (content_width, content_height). The shared canvas is
    the max content box plus this padding, with each view centered.
    """
    content_w = max(view[0] for view in views)
    content_h = max(view[1] for view in views)
    pad_x_cap = math.ceil(margin * content_w / (1 - 2 * margin)) + 2
    pad_y_cap = math.ceil(margin * content_h / (1 - 2 * margin)) + 2

    def clears(pad_x, pad_y):
        canvas_w = content_w + 2 * pad_x
        canvas_h = content_h + 2 * pad_y
        for view_w, view_h in views:
            for gallery_aspect in GALLERY_ASPECTS:
                side, top = gaps(canvas_w, canvas_h, view_w, view_h, gallery_aspect)
                if side < margin or top < margin:
                    return False
        return True

    best = None
    for pad_x in range(pad_x_cap + 1):
        for pad_y in range(pad_y_cap + 1):
            if clears(pad_x, pad_y):
                area = (content_w + 2 * pad_x) * (content_h + 2 * pad_y)
                if best is None or area < best[0]:
                    best = (area, pad_x, pad_y)
                break
    if best is None:
        raise RuntimeError(f"no padding meets a {margin:.0%} margin")
    return best[1], best[2]


def crop(image):
    ys, xs = np.where(image[:, :, 3] > ALPHA_THRESHOLD)
    if len(ys) == 0:
        raise RuntimeError("cutout has no opaque pixels")
    return image[ys.min() : ys.max() + 1, xs.min() : xs.max() + 1]


def fit_height(image, height):
    scale = height / image.shape[0]
    width = max(1, int(round(image.shape[1] * scale)))
    straight = image.astype(np.float32)
    straight[:, :, :3] *= straight[:, :, 3:4] / 255
    interpolation = cv2.INTER_AREA if scale < 1 else cv2.INTER_CUBIC
    resized = cv2.resize(straight, (width, height), interpolation=interpolation)
    alpha = resized[:, :, 3:4]
    rgb = np.divide(resized[:, :, :3], np.maximum(alpha / 255, 1e-4))
    return np.dstack(
        [np.clip(rgb, 0, 255).astype(np.uint8), np.clip(alpha, 0, 255).astype(np.uint8)]
    )


def center(image, canvas_w, canvas_h):
    canvas = np.zeros((canvas_h, canvas_w, 4), np.uint8)
    y = (canvas_h - image.shape[0]) // 2
    x = (canvas_w - image.shape[1]) // 2
    canvas[y : y + image.shape[0], x : x + image.shape[1]] = image
    return canvas


def load_pair(slug, photo_dir):
    paths = [photo_dir / f"{slug}-front.png", photo_dir / f"{slug}-three-quarter.png"]
    missing = [path for path in paths if not path.exists()]
    if missing:
        raise SystemExit(f"missing {missing[0]}")
    front, three = (crop(np.array(Image.open(path).convert("RGBA"))) for path in paths)
    if abs(front.shape[0] - three.shape[0]) / max(front.shape[0], three.shape[0]) > 0.02:
        three = fit_height(three, front.shape[0])
        print(f"scaled three-quarter to the front height ({front.shape[0]}px)")
    return front, three


def report(slug, canvas, views, margin):
    print(f"{slug}: {canvas.shape[1]}x{canvas.shape[0]} canvas, minimum margin {margin:.0%}")
    for label, (content_w, content_h) in views:
        for gallery_aspect in GALLERY_ASPECTS:
            side, top = gaps(canvas.shape[1], canvas.shape[0], content_w, content_h, gallery_aspect)
            print(f"  {label:14} aspect {gallery_aspect:.2f}  side {side * 100:4.1f}%  top {top * 100:4.1f}%")


def main():
    parser = argparse.ArgumentParser(description="Pad catalog cutouts to the gallery margin.")
    parser.add_argument("slug", help="product slug, matching public/products/<slug>-front.png")
    parser.add_argument("--dry-run", action="store_true", help="print the padding and write nothing")
    parser.add_argument("--margin", type=float, default=MIN_MARGIN, help="minimum card margin, default 0.09")
    parser.add_argument("--dir", type=Path, default=PHOTO_DIR, help="directory of product PNGs")
    args = parser.parse_args()

    front, three = load_pair(args.slug, args.dir)
    views = [("front", (front.shape[1], front.shape[0])), ("three-quarter", (three.shape[1], three.shape[0]))]
    pad_x, pad_y = padding_for([size for _, size in views], args.margin)
    canvas_w = max(front.shape[1], three.shape[1]) + 2 * pad_x
    canvas_h = max(front.shape[0], three.shape[0]) + 2 * pad_y
    print(f"padding {pad_x}px horizontal, {pad_y}px vertical")
    report(args.slug, np.zeros((canvas_h, canvas_w, 4), np.uint8), views, args.margin)
    if args.dry_run:
        return

    three_placed = center(three, canvas_w, canvas_h)
    files = {
        "front": center(front, canvas_w, canvas_h),
        "three-quarter": three_placed,
        "one-quarter": np.ascontiguousarray(three_placed[:, ::-1]),
    }
    for angle, image in files.items():
        Image.fromarray(image, "RGBA").save(args.dir / f"{args.slug}-{angle}.png")
    print(f"wrote {args.slug}-front.png, {args.slug}-one-quarter.png, {args.slug}-three-quarter.png")


if __name__ == "__main__":
    try:
        main()
    except BrokenPipeError:
        sys.exit(0)
