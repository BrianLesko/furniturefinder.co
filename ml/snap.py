"""Straight, edge-snapped room lines from uLayout's per-column boundaries.

uLayout gives one ceiling and one floor height per column, so where a column
looks through a doorway or past a wall that juts out, the boundary jumps.
Those jumps are cut out, each remaining run is split into straight segments,
and every segment is moved onto the strongest image edge close to it. Wall
corners are where segments meet; a corner seen in both the ceiling and the
floor becomes an upright, drawn toward the vertical vanishing point and
snapped the same way. The back wall is the long, flattest ceiling segment,
and its four corners are where its uprights cross the ceiling and floor.
"""

import math

import cv2
import numpy as np

SPLIT_TOL = 0.006  # of the image diagonal
MIN_SEGMENT = 0.04  # of the image width
JUMP = 0.02  # of the image height
STEEP = 2.5  # |dy/dx| beyond which a boundary is not a wall edge
SNAP_REACH = 0.015  # of the image height
SNAP_TURN = 1.5  # degrees either way
CORNER_GAP = 0.03  # of the image width
UPRIGHT_PAIR = 0.06  # of the image width
SIDE_REACH = 0.08  # of the image width, from a back wall end to an upright
MIN_BACK_WALL = 0.15  # of the image width
MIN_LINE_GAP = 0.2  # of the image width, between two corners used as uprights
BACK_WALL_SLOPE = 0.2  # |dy/dx| beyond which a wall is side-on, not facing the camera


def gradients(rgb):
    gray = cv2.cvtColor(rgb, cv2.COLOR_RGB2GRAY).astype(np.float32)
    gray = cv2.GaussianBlur(gray, (0, 0), 1.2)
    return cv2.Sobel(gray, cv2.CV_32F, 1, 0, ksize=3), cv2.Sobel(gray, cv2.CV_32F, 0, 1, ksize=3)


def runs(points, w, h):
    """Split a boundary polyline wherever it jumps, turns steep, or has a gap."""
    if len(points) < 2:
        return []
    pts = np.asarray(points, np.float64)
    pts = pts[np.argsort(pts[:, 0])]
    out, start = [], 0
    for i in range(1, len(pts)):
        dx = pts[i, 0] - pts[i - 1, 0]
        dy = pts[i, 1] - pts[i - 1, 1]
        gap = dx > CORNER_GAP * w
        jump = abs(dy) > JUMP * h
        steep = abs(dy) > STEEP * max(dx, 1e-6) and abs(dy) > 0.004 * h
        if gap or jump or steep:
            out.append(pts[start:i])
            start = i
    out.append(pts[start:])
    return [r for r in out if len(r) >= 4 and r[-1, 0] - r[0, 0] >= MIN_SEGMENT * w]


def fit(pts):
    """Total least squares line through points: (point, unit direction)."""
    c = pts.mean(axis=0)
    _, _, vt = np.linalg.svd(pts - c)
    d = vt[0]
    if d[0] < 0:
        d = -d
    return c, d


def split(pts, tol):
    """Douglas-Peucker: cut at the point farthest from the end-to-end chord."""
    if len(pts) < 8:
        return [pts]
    a, b = pts[0], pts[-1]
    d = (b - a) / (np.hypot(*(b - a)) + 1e-9)
    dist = np.abs((pts - a) @ np.array([-d[1], d[0]]))
    k = int(dist.argmax())
    if dist[k] <= tol or k < 3 or k > len(pts) - 4:
        return [pts]
    return split(pts[: k + 1], tol) + split(pts[k:], tol)


def merge_collinear(parts, tol):
    """Join neighbouring pieces that one straight line fits within tol."""
    out = [parts[0]]
    for p in parts[1:]:
        joined = np.vstack([out[-1], p])
        c, d = fit(joined)
        if np.abs((joined - c) @ np.array([-d[1], d[0]])).max() <= tol:
            out[-1] = joined
        else:
            out.append(p)
    return out


def segment(pts):
    c, d = fit(pts)
    t = (pts - c) @ d
    return c + d * t.min(), c + d * t.max()


def edge_score(gx, gy, a, b, samples=120):
    h, w = gx.shape
    t = np.linspace(0, 1, samples)[:, None]
    p = a + (b - a) * t
    d = b - a
    n = np.array([-d[1], d[0]]) / (np.hypot(*d) + 1e-9)
    xs = np.clip(p[:, 0], 0, w - 1).astype(np.float32)
    ys = np.clip(p[:, 1], 0, h - 1).astype(np.float32)
    inside = (p[:, 0] >= 0) & (p[:, 0] < w) & (p[:, 1] >= 0) & (p[:, 1] < h)
    if inside.sum() < samples * 0.5:
        return 0.0
    vx = cv2.remap(gx, xs[None], ys[None], cv2.INTER_LINEAR)[0]
    vy = cv2.remap(gy, xs[None], ys[None], cv2.INTER_LINEAR)[0]
    return float(np.abs(vx * n[0] + vy * n[1])[inside].mean())


def snap_segment(gx, gy, a, b, reach):
    """Best nearby placement of segment a-b along image edges."""
    mid = (a + b) / 2
    d = b - a
    length = np.hypot(*d)
    u = d / (length + 1e-9)
    n = np.array([-u[1], u[0]])
    best = (edge_score(gx, gy, a, b), a, b)
    for turn in np.linspace(-SNAP_TURN, SNAP_TURN, 13):
        r = math.radians(turn)
        ur = np.array([u[0] * math.cos(r) - u[1] * math.sin(r), u[0] * math.sin(r) + u[1] * math.cos(r)])
        nr = np.array([-ur[1], ur[0]])
        for off in np.arange(-reach, reach + 1, 1.0):
            c = mid + nr * off
            pa, pb = c - ur * length / 2, c + ur * length / 2
            s = edge_score(gx, gy, pa, pb)
            if s > best[0]:
                best = (s, pa, pb)
    return best[1], best[2], best[0]


def intersect(a1, a2, b1, b2):
    da, db = a2 - a1, b2 - b1
    den = da[0] * db[1] - da[1] * db[0]
    if abs(den) < 1e-9:
        return None
    t = ((b1[0] - a1[0]) * db[1] - (b1[1] - a1[1]) * db[0]) / den
    return a1 + da * t


def lines_for(points, gx, gy, w, h):
    tol = SPLIT_TOL * math.hypot(w, h)
    reach = SNAP_REACH * h
    segs, corners = [], []
    for run in runs(points, w, h):
        pieces = [segment(p) for p in merge_collinear(split(run, tol), 1.5 * tol)]
        pieces = [(a, b) for a, b in pieces if b[0] - a[0] >= MIN_SEGMENT * w]
        snapped = [snap_segment(gx, gy, a, b, reach)[:2] for a, b in pieces]
        for i in range(len(snapped) - 1):
            (a1, a2), (b1, b2) = snapped[i], snapped[i + 1]
            if b1[0] - a2[0] > CORNER_GAP * w:
                continue
            p = intersect(a1, a2, b1, b2)
            if p is not None and abs(p[0] - (a2[0] + b1[0]) / 2) < CORNER_GAP * w:
                corners.append(p)
        segs.extend(snapped)
    return segs, corners


def toward(point, vp, length):
    """Unit direction from point toward the vertical vanishing point, pointing down."""
    if abs(vp[2]) < 1e-12:
        d = np.array([vp[0], vp[1]])
    else:
        d = np.array([vp[0] / vp[2], vp[1] / vp[2]]) - point
        if vp[1] / vp[2] < point[1]:
            d = -d
    d = d / (np.hypot(*d) + 1e-9)
    if d[1] < 0:
        d = -d
    return d * length


def at_y(a, b, y):
    t = (y - a[1]) / (b[1] - a[1]) if abs(b[1] - a[1]) > 1e-9 else 0.0
    return a + (b - a) * t


def upright_through(point, vp, gx, gy, h):
    d = toward(point, vp, h)
    a, b = point - d, point + d
    a, b, _ = snap_segment(gx, gy, a, b, SNAP_REACH * h)
    return a, b


def snap_layout(rgb, result):
    h, w = rgb.shape[:2]
    gx, gy = gradients(rgb)
    vpz = np.array(result["vpz"], np.float64)
    vp = np.array([vpz[0] * w / 512, vpz[1] * h / 512, vpz[2]])

    ceiling, c_corners = lines_for(result["ceiling"], gx, gy, w, h)
    floor, f_corners = lines_for(result["floor"], gx, gy, w, h)

    uprights = []
    for c in c_corners:
        match = [f for f in f_corners if abs(f[0] - c[0]) < UPRIGHT_PAIR * w and f[1] > c[1]]
        if match:
            f = min(match, key=lambda f: abs(f[0] - c[0]))
            a, b = upright_through((c + f) / 2, vp, gx, gy, h)
            uprights.append((at_y(a, b, c[1]), at_y(a, b, f[1])))

    def slope(s):
        (a, b) = s
        return abs((b[1] - a[1]) / max(b[0] - a[0], 1e-6))

    quad = None
    walls = [s for s in ceiling if s[1][0] - s[0][0] >= MIN_BACK_WALL * w and slope(s) <= BACK_WALL_SLOPE]
    if walls:
        top = max(walls, key=lambda s: (s[1][0] - s[0][0]) * (1 - 3 * slope(s)))
        x0, x1 = top[0][0], top[1][0]
        under = []
        for s in floor:
            overlap = min(s[1][0], x1) - max(s[0][0], x0)
            if overlap >= 0.5 * (x1 - x0) and slope(s) <= BACK_WALL_SLOPE:
                under.append(s)
        if under:
            bottom = min(under, key=slope)
            sides = []
            for end in (top[0], top[1]):
                near = []
                for u in uprights:
                    p = intersect(*u, *top)
                    if p is not None and abs(p[0] - end[0]) < SIDE_REACH * w:
                        near.append((abs(p[0] - end[0]), u))
                sides.append(min(near, key=lambda n: n[0])[1] if near else upright_through(end, vp, gx, gy, h))
            tl = intersect(*sides[0], *top)
            tr = intersect(*sides[1], *top)
            br = intersect(*sides[1], *bottom)
            bl = intersect(*sides[0], *bottom)
            if all(p is not None for p in (tl, tr, br, bl)) and tl[0] < tr[0] and bl[0] < br[0]:
                quad = [tl, tr, br, bl]

    def seg_list(segs):
        return [[round(float(v), 1) for v in (*a, *b)] for a, b in segs]

    return {
        "ceiling": seg_list(ceiling),
        "floor": seg_list(floor),
        "uprights": seg_list(uprights),
        "quad": [[round(float(p[0]), 1), round(float(p[1]), 1)] for p in quad] if quad else None,
        "lines": None if quad else seg_list(stand_up(uprights, vp, w, h)),
        "plumb": seg_list(stand_up([], np.array(result["calib"]["vp"], np.float64), w, h)),
    }


def stand_up(uprights, vp, w, h):
    """Two lines to stand upright when no wall faces the camera.

    The outermost wall corners are used when they are far enough apart; any
    missing line runs toward the model's vertical vanishing point, which still
    takes out the camera's tilt.
    """
    picks = sorted(uprights, key=lambda u: u[0][0])
    if len(picks) >= 2 and picks[-1][0][0] - picks[0][0][0] >= MIN_LINE_GAP * w:
        picks = [picks[0], picks[-1]]
    else:
        picks = picks[:1]
    xs = [0.25 * w, 0.75 * w]
    if picks:
        x = picks[0][0][0]
        xs = [min(0.9 * w, x + 0.4 * w) if x < w / 2 else max(0.1 * w, x - 0.4 * w)]
    for x in xs[: 2 - len(picks)]:
        p = np.array([x, h / 2])
        d = toward(p, vp, 0.35 * h)
        picks.append((p - d, p + d))
    return sorted(picks, key=lambda u: u[0][0])
