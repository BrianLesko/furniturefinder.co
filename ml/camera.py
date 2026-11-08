"""Judge where the photographer stood: camera height and tilt.

Seen from the camera, the line where a wall meets the ceiling sits at some
angle above level and the line where it meets the floor some angle below. For
a wall at distance d, the camera is d * tan(below) above the floor and the
ceiling d * tan(above) above the camera, so the camera's share of the room
height is tan(below) / (tan(below) + tan(above)) whatever d is. Taking the
median over every column where both lines were found makes it hold across
walls at different distances.
"""

import numpy as np

# Listing photographers usually shoot from about chest height, level.
HIGH = 0.68  # share of the room height
LOW = 0.30
TILT = 8.0  # degrees down or up before the verticals lean badly
MIN_COLUMNS = 20
ASSUMED_CEILING_FT = 8.0


def elevations(points, f, c, up):
    """Angle above level, in radians, of each pixel's ray."""
    p = np.asarray(points, np.float64)
    rays = np.stack([(p[:, 0] - c[0]) / f, (p[:, 1] - c[1]) / f, np.ones(len(p))], axis=1)
    rays /= np.linalg.norm(rays, axis=1, keepdims=True)
    return np.arcsin(np.clip(rays @ up, -1, 1))


def sample_row(line, xs):
    """Y of `line` at each x. `bridged` is false where x falls in a gap."""
    span = float(line[-1, 0] - line[0, 0])
    limit = max(24.0, 0.03 * span)
    idx = np.searchsorted(line[:, 0], xs)
    inside = (idx > 0) & (idx < len(line))
    idx = np.clip(idx, 1, len(line) - 1)
    gap = line[idx, 0] - line[idx - 1, 0]
    t = (xs - line[idx - 1, 0]) / np.maximum(gap, 1e-9)
    y = line[idx - 1, 1] + t * (line[idx, 1] - line[idx - 1, 1])
    return y, inside & (gap <= limit)


def camera_check(result):
    calib = result["calib"]
    # GeoCalib's gravity vector points up in camera coordinates.
    up = np.asarray(calib["gravity"], np.float64)
    up /= np.linalg.norm(up)
    ceiling = np.asarray(result["ceiling"], np.float64)
    floor = np.asarray(result["floor"], np.float64)

    height = None
    columns = 0
    if len(ceiling) >= 2 and len(floor) >= 2:
        floor = floor[np.argsort(floor[:, 0])]
        lo, hi = max(ceiling[:, 0].min(), floor[0, 0]), min(ceiling[:, 0].max(), floor[-1, 0])
        top = ceiling[(ceiling[:, 0] >= lo) & (ceiling[:, 0] <= hi)]
        if len(top):
            ys, bridged = sample_row(floor, top[:, 0])
            bottom = np.stack([top[:, 0], ys], axis=1)
            above = elevations(top, calib["f"], calib["c"], up)
            below = -elevations(bottom, calib["f"], calib["c"], up)
            ok = (above > np.radians(1)) & (below > np.radians(1)) & bridged
            columns = int(ok.sum())
            if columns >= MIN_COLUMNS:
                a, b = np.tan(above[ok]), np.tan(below[ok])
                height = float(np.median(b / (a + b)))

    pitch = float(calib["pitch"])
    problems = []
    if height is not None and height > HIGH:
        problems.append(
            f"The camera was about {height * ASSUMED_CEILING_FT:.1f} ft up on an {ASSUMED_CEILING_FT:.0f} ft ceiling. "
            "Lower it to chest height, about 4 to 5 ft."
        )
    elif height is not None and height < LOW:
        problems.append(
            f"The camera was about {height * ASSUMED_CEILING_FT:.1f} ft up on an {ASSUMED_CEILING_FT:.0f} ft ceiling. "
            "Raise it to chest height, about 4 to 5 ft."
        )
    if pitch < -TILT:
        problems.append(f"The camera was tilted {-pitch:.0f}° down. Hold it level and step back to fit the room in.")
    elif pitch > TILT:
        problems.append(f"The camera was tilted {pitch:.0f}° up. Hold it level.")

    return {
        "height": None if height is None else round(height, 3),
        "columns": columns,
        "pitch": round(pitch, 1),
        "retake": bool(problems),
        "advice": problems,
    }
