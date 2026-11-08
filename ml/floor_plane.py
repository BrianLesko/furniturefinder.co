"""Floor line from a metric point map.

MoGe-2 gives a 3D point for every pixel. GeoCalib's gravity says which way is
up, so the floor is the horizontal plane through the pixels SegFormer calls
floor. The line is the near edge of the floor that actually sits on that plane.
An island or a counter sits above it and is left out.

The checkpoint is Ruicheng/moge-2-vitl-normal, cached under ml/.hf.
"""

import os

HERE = os.path.dirname(os.path.abspath(__file__))
os.environ.setdefault("HF_HOME", os.path.join(HERE, ".hf"))

import numpy as np
import torch
from moge.model.v2 import MoGeModel

MODEL = "Ruicheng/moge-2-vitl-normal"
MIN_FLOOR = 500
MIN_RUN = 12
MEDIAN = 15
SPLIT_GAP = 8
SPLIT_JUMP = 0.025
MIN_PART = 0.04
MIN_POINTS = 20


class FloorPlane:
    def __init__(self, device):
        self.device = torch.device(device)
        self.model = MoGeModel.from_pretrained(MODEL).to(self.device).eval()

    @torch.inference_mode()
    def line(self, rgb, gravity, labels, floor_ids):
        """Visible floor edge in original pixels, or None."""
        try:
            return self._line(rgb, gravity, labels, floor_ids)
        except Exception as exc:
            print(f"floor plane failed: {exc}", flush=True)
            return None

    def _line(self, rgb, gravity, labels, floor_ids):
        if gravity is None or labels is None:
            return None
        image = torch.tensor(rgb / 255, dtype=torch.float32, device=self.device).permute(2, 0, 1)
        points = self.model.infer(image)["points"].float().cpu().numpy()
        valid = np.isfinite(points).all(axis=-1)
        floor = np.isin(labels, list(floor_ids)) & valid
        if int(floor.sum()) < MIN_FLOOR:
            return None
        up = np.asarray(gravity, np.float64)
        up /= np.linalg.norm(up) + 1e-9
        height = points @ up
        level = float(np.median(height[floor]))
        mad = float(np.median(np.abs(height[floor] - level)))
        tol = max(0.04, 3 * mad)
        band = floor & (np.abs(height - level) < tol)
        h, w = band.shape
        ys = np.full(w, -1, np.int32)
        for x in range(w):
            col = np.flatnonzero(band[:, x])
            if len(col) >= MIN_RUN:
                ys[x] = int(col[0])
        if (ys >= 0).any():
            smoothed = ys.copy()
            for x in np.flatnonzero(ys >= 0):
                win = ys[max(0, x - MEDIAN) : x + MEDIAN + 1]
                win = win[win >= 0]
                if len(win):
                    smoothed[x] = int(np.median(win))
            ys = smoothed
        parts, cur = [], []
        jump = SPLIT_JUMP * h
        for x, y in enumerate(ys.tolist()):
            if y < 0 or (cur and (x - cur[-1][0] > SPLIT_GAP or abs(y - cur[-1][1]) > jump)):
                if len(cur) > MIN_POINTS:
                    parts.append(cur)
                cur = [] if y < 0 else [(x, y)]
                continue
            cur.append((x, y))
        if len(cur) > MIN_POINTS:
            parts.append(cur)
        parts = [part for part in parts if part[-1][0] - part[0][0] > MIN_PART * w]
        if not parts:
            return None
        return [[round(float(x), 1), round(float(y), 1)] for part in parts for x, y in part]
