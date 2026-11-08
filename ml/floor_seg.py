"""Floor line from a semantic segmentation of the photo.

uLayout predicts one floor height per column, so its line rides countertops,
islands, and door casings. SegFormer labels the floor (and rugs) and whatever
is standing on it. The line kept here is the top of each floor run that has
a wall, cabinet, or fixture directly above it: the edge the camera can
actually see. Columns with no such junction are left out of the polyline.

A line that only catches a doorway, and would move the camera height by more
than a foot, is rejected so the caller can keep uLayout.

    .venv/bin/python floor_seg.py photo.webp [more...] --out out/
"""

import os

HERE = os.path.dirname(os.path.abspath(__file__))
os.environ.setdefault("HF_HOME", os.path.join(HERE, ".hf"))

import argparse

import cv2
import numpy as np
import torch
import torch.nn.functional as F
from transformers import AutoImageProcessor, SegformerForSemanticSegmentation

MODEL = "nvidia/segformer-b2-finetuned-ade-512-512"
LONG_SIDE = 1024
MIN_RUN = 12
ABOVE_BAND = 8
# A contact in the bottom strip is the photo's near edge, not a wall.
YMAX_FRAC = 0.88
MEDIAN = 15
SPLIT_GAP = 8
SPLIT_JUMP = 0.025
MIN_PART = 0.04
MIN_POINTS = 20
MIN_COVERAGE = 0.15
# Straighten carpet noise. A real corner or stair is much taller than this.
STRAIGHT_TOL = 0.007
# A partial line that moves the 8 ft camera height this many inches is a
# different wall than the ceiling, usually a doorway into the next room.
SHIFT_IN = 14
PARTIAL = 0.55

# Classes that sit on the floor. The wall-floor junction is the baseboard;
# the others are the toe of a cabinet, tub, or appliance.
ABOVE_NAMES = (
    "wall",
    "cabinet",
    "door",
    "screen door",
    "bathtub",
    "toilet",
    "chest of drawers",
    "refrigerator",
    "washer",
)


class FloorSeg:
    def __init__(self, device=None):
        self.device = torch.device(device or ("cuda" if torch.cuda.is_available() else "cpu"))
        self.proc = AutoImageProcessor.from_pretrained(MODEL)
        self.model = SegformerForSemanticSegmentation.from_pretrained(MODEL).to(self.device).eval()
        labels = {int(i): name.strip() for i, name in self.model.config.id2label.items()}
        self.floor_ids = [i for i, name in labels.items() if name in ("floor", "rug")]
        self.above_ids = [i for i, name in labels.items() if name in ABOVE_NAMES]
        if not self.floor_ids or not self.above_ids:
            raise RuntimeError("SegFormer is missing a floor or wall label.")

    @torch.no_grad()
    def labels_of(self, rgb):
        """Class id per original pixel. The network runs at LONG_SIDE."""
        height, width = rgb.shape[:2]
        img = rgb
        long = max(height, width)
        if long > LONG_SIDE:
            scale = LONG_SIDE / long
            img = cv2.resize(
                rgb,
                (max(1, round(width * scale)), max(1, round(height * scale))),
                interpolation=cv2.INTER_AREA,
            )
        inputs = {k: v.to(self.device) for k, v in self.proc(images=img, return_tensors="pt").items()}
        logits = self.model(**inputs).logits
        up = F.interpolate(logits, size=img.shape[:2], mode="bilinear", align_corners=False)
        pred = up.argmax(dim=1)[0].detach().cpu().numpy().astype(np.uint8)
        if pred.shape[:2] != (height, width):
            pred = cv2.resize(pred, (width, height), interpolation=cv2.INTER_NEAREST)
        return pred

    def line(self, rgb, fallback=None, ceiling=None, horizon=None, pred=None):
        """Wall-floor polyline in original pixels, or None to keep `fallback`."""
        try:
            if pred is None:
                pred = self.labels_of(rgb)
        except Exception as exc:
            print(f"floor seg failed: {exc}", flush=True)
            return None
        parts = contact_parts(pred, self.floor_ids, self.above_ids)
        if not parts:
            return None
        height, width = pred.shape[:2]
        covered = sum(part[-1][0] - part[0][0] for part in parts) / width
        if covered < MIN_COVERAGE:
            return None
        points = []
        tol = STRAIGHT_TOL * height
        for part in parts:
            points.extend(straighten(part, tol))
        if len(points) < 2:
            return None
        if fallback and ceiling and horizon and not keeps_scale(ceiling, fallback, points, horizon, height, width, covered):
            return None
        return [[round(float(x), 1), round(float(y), 1)] for x, y in points]


def contact_parts(pred, floor_ids, above_ids):
    """Stretches of (x, y) where a floor run starts under a wall or fixture."""
    floor = np.isin(pred, list(floor_ids)).astype(np.uint8)
    floor = cv2.morphologyEx(floor, cv2.MORPH_CLOSE, np.ones((9, 9), np.uint8))
    floor = cv2.morphologyEx(floor, cv2.MORPH_OPEN, np.ones((5, 5), np.uint8))
    above = np.isin(pred, list(above_ids))
    height, width = floor.shape
    ys = np.full(width, -1, np.int32)
    limit = YMAX_FRAC * height
    for x in range(width):
        col = floor[:, x]
        y = 0
        while y < height:
            if not col[y]:
                y += 1
                continue
            y0 = y
            while y < height and col[y]:
                y += 1
            if y0 >= limit:
                break
            if y - y0 >= MIN_RUN and above[max(0, y0 - ABOVE_BAND) : y0, x].any():
                ys[x] = y0
                break
    if (ys >= 0).any():
        smoothed = ys.copy()
        for x in np.flatnonzero(ys >= 0):
            win = ys[max(0, x - MEDIAN) : x + MEDIAN + 1]
            win = win[win >= 0]
            if len(win):
                smoothed[x] = int(np.median(win))
        ys = smoothed
    parts, cur = [], []
    jump = SPLIT_JUMP * height
    for x, y in enumerate(ys.tolist()):
        if y < 0 or (cur and (x - cur[-1][0] > SPLIT_GAP or abs(y - cur[-1][1]) > jump)):
            if len(cur) > MIN_POINTS:
                parts.append(cur)
            cur = [] if y < 0 else [(x, y)]
            continue
        cur.append((x, y))
    if len(cur) > MIN_POINTS:
        parts.append(cur)
    return [part for part in parts if part[-1][0] - part[0][0] > MIN_PART * width]


def straighten(part, tol):
    """Replace a noisy run with the straight segments that fit it."""
    pts = np.asarray(part, np.float64)

    def pieces(pts):
        if len(pts) < 6:
            return [pts]
        a, b = pts[0], pts[-1]
        length = np.hypot(*(b - a)) + 1e-9
        dist = np.abs((pts[:, 0] - a[0]) * (a[1] - b[1]) + (pts[:, 1] - a[1]) * (b[0] - a[0])) / length
        k = int(dist.argmax())
        if dist[k] <= tol or k < 2 or k > len(pts) - 3:
            return [pts]
        return pieces(pts[: k + 1]) + pieces(pts[k:])

    out = []
    for piece in pieces(pts):
        a, b = piece[0], piece[-1]
        steps = max(2, int(round(np.hypot(*(b - a)))))
        seg = a + (b - a) * np.linspace(0, 1, steps)[:, None]
        if len(out):
            seg = seg[1:]
        out.append(seg)
    merged = np.vstack(out)
    return [(float(x), float(y)) for x, y in merged]


def row_at(line, x, limit):
    xs = line[:, 0]
    i = int(np.searchsorted(xs, x))
    if i <= 0 or i >= len(xs):
        return None
    gap = float(xs[i] - xs[i - 1])
    if gap > limit:
        return None
    t = (x - xs[i - 1]) / gap if gap else 0.0
    return float(line[i - 1, 1] + t * (line[i, 1] - line[i - 1, 1]))


def camera_inches(ceiling, floor, horizon, height, width, ceiling_in=96):
    """Same median the studio uses: an 8 ft ceiling on columns that see both lines."""
    if not ceiling or not floor or not horizon:
        return None
    ceiling = np.asarray(ceiling, np.float64)
    floor = np.asarray(floor, np.float64)
    if ceiling.ndim != 2 or floor.ndim != 2 or len(ceiling) < 2 or len(floor) < 2:
        return None
    ceiling = ceiling[np.argsort(ceiling[:, 0])]
    floor = floor[np.argsort(floor[:, 0])]
    hy = float(np.mean(np.asarray(horizon, np.float64)[:, 1]))
    flimit = max(24.0, 0.03 * (floor[-1, 0] - floor[0, 0]))
    climit = max(24.0, 0.03 * (ceiling[-1, 0] - ceiling[0, 0]))
    cams = []
    for i in range(49):
        x = width * (0.04 + 0.92 * i / 48)
        top = row_at(ceiling, x, climit)
        bottom = row_at(floor, x, flimit)
        if top is None or bottom is None:
            continue
        if bottom < hy + 8 or top > hy - 8 or bottom <= top:
            continue
        cams.append(ceiling_in * (bottom - hy) / (bottom - top))
    if len(cams) < 3:
        return None
    cams.sort()
    return cams[len(cams) // 2]


def keeps_scale(ceiling, fallback, points, horizon, height, width, covered):
    old = camera_inches(ceiling, fallback, horizon, height, width)
    new = camera_inches(ceiling, points, horizon, height, width)
    if old is None:
        return True
    if new is None:
        return covered >= PARTIAL
    if abs(old - new) > SHIFT_IN and covered < PARTIAL:
        return False
    return True


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("photos", nargs="+")
    parser.add_argument("--out", default="out")
    args = parser.parse_args()
    os.makedirs(args.out, exist_ok=True)
    seg = FloorSeg()
    for path in args.photos:
        bgr = cv2.imread(path, cv2.IMREAD_COLOR)
        if bgr is None:
            print(f"skip {path}")
            continue
        rgb = cv2.cvtColor(bgr, cv2.COLOR_BGR2RGB)
        points = seg.line(rgb)
        print(os.path.basename(path), 0 if not points else len(points))
        if not points:
            continue
        cv2.polylines(bgr, [np.array(points, np.int32)], False, (0, 0, 255), 3, cv2.LINE_AA)
        name = os.path.splitext(os.path.basename(path))[0]
        cv2.imwrite(os.path.join(args.out, f"{name}.floor.jpg"), bgr)


if __name__ == "__main__":
    main()
