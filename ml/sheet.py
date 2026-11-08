"""View sheets: every missing view of a piece generated in one image.

Generating the views together, the way sprite tools make an 8-direction
sheet, keeps them consistent with each other. `guide` draws the layout we
want back: a grid of panels, each holding the piece's box projected at that
panel's azimuth and altitude, all at one scale and standing on one floor
row, with the front face tinted so the model knows which way is forward.
The image model gets that guide plus the real photos and is asked to fill
every panel with the real piece. `split` cuts the result back into panels
and mattes each one.
"""

import math

import cv2
import numpy as np
from PIL import Image, ImageDraw, ImageFont

# The image API takes custom sizes: edges up to 3840 but 2560 is the largest
# non-experimental, 8.3 megapixels total, multiples of 16.
MAX_EDGE = 2560
MAX_PIXELS = 8_294_400
MARGIN = 0.13  # of the cell, around the biggest box
FRONT_TINT = (255, 214, 226)
FACE_TINT = {"top": 236, "left": 206, "right": 206, "back": 220}
EDGE = (60, 60, 60)
INSET = 6  # pixels trimmed from each panel edge before matting, to drop any grid line


def grid_for(n):
    """Columns, rows, and square cell size giving `n` panels the most pixels each."""
    best = None
    for cols in range(1, n + 1):
        rows = math.ceil(n / cols)
        cell = min(MAX_EDGE // cols, MAX_EDGE // rows, int(math.sqrt(MAX_PIXELS / (cols * rows))))
        cell -= cell % 16
        if best is None or cell > best[2]:
            best = (cols, rows, cell)
    return best


def layout(n):
    cols, rows, cell = grid_for(n)
    cells = [(c * cell, r * cell, cell, cell) for r in range(rows) for c in range(cols)][:n]
    return (cols * cell, rows * cell), cells


def project(azimuth, altitude, u, v, h):
    """u right, v toward the front, h up; returns x right, y down, depth toward the camera."""
    a, b = math.radians(azimuth), math.radians(altitude)
    x = u * math.cos(a) - v * math.sin(a)
    toward = u * math.sin(a) + v * math.cos(a)
    y = toward * math.sin(b) - h * math.cos(b)
    depth = toward * math.cos(b) + h * math.sin(b)
    return x, y, depth


def box(azimuth, altitude, inches):
    w, d, h = inches["width"] / 2, inches["depth"] / 2, inches["height"]
    corners = [(u, v, hh) for hh in (0, h) for (u, v) in ((-w, -d), (w, -d), (w, d), (-w, d))]
    return corners, [project(azimuth, altitude, *c) for c in corners]


QUADS = {"bottom": [0, 1, 2, 3], "top": [4, 5, 6, 7], "back": [1, 0, 4, 5], "front": [3, 2, 6, 7], "left": [0, 3, 7, 4], "right": [2, 1, 5, 6]}
NORMALS = {"top": (0, 0, 1), "bottom": (0, 0, -1), "back": (0, -1, 0), "front": (0, 1, 0), "left": (-1, 0, 0), "right": (1, 0, 0)}


def font(size):
    for name in ("DejaVuSans-Bold.ttf", "DejaVuSans.ttf", "LiberationSans-Bold.ttf"):
        try:
            return ImageFont.truetype(name, size)
        except OSError:
            continue
    return ImageFont.load_default()


def read_rgba(path):
    image = cv2.imread(str(path), cv2.IMREAD_UNCHANGED)
    if image is None:
        raise ValueError(f"cannot read {path}")
    if image.ndim == 2:
        image = cv2.cvtColor(image, cv2.COLOR_GRAY2BGRA)
    elif image.shape[2] == 3:
        image = cv2.cvtColor(image, cv2.COLOR_BGR2BGRA)
    ys, xs = np.nonzero(image[:, :, 3] > 8)
    if not len(ys):
        raise ValueError(f"{path} is empty")
    return image[ys.min() : ys.max() + 1, xs.min() : xs.max() + 1]


def paste_photo(image, path, flip, rect):
    """Set a real cutout into its box: as tall as the box, centered, feet on the box's bottom edge."""
    rgba = read_rgba(path)
    if flip:
        rgba = np.ascontiguousarray(rgba[:, ::-1])
    h = max(1, rect[3] - rect[1])
    w = max(1, round(rgba.shape[1] * h / rgba.shape[0]))
    rgba = cv2.resize(rgba, (w, h), interpolation=cv2.INTER_AREA if h < rgba.shape[0] else cv2.INTER_CUBIC)
    photo = Image.fromarray(cv2.cvtColor(rgba, cv2.COLOR_BGRA2RGBA), "RGBA")
    x = int(round((rect[0] + rect[2]) / 2 - w / 2))
    image.paste(photo, (x, rect[3] - h), photo)


def guide(panels, altitude, inches, out_path):
    """Draw the sheet layout. `panels` is a list of {angle, azimuth, label, photo?, flip?}.

    Panels with a `photo` are finished views: the real cutout is set into its
    box so the sheet reads as a rotation sequence with gaps to fill.
    """
    size, cells = layout(len(panels))
    cell = cells[0][2]
    projected = [box(p["azimuth"], altitude, inches)[1] for p in panels]
    spans_x = [max(x for x, _, _ in pts) - min(x for x, _, _ in pts) for pts in projected]
    ups = [-min(y for _, y, _ in pts) for pts in projected]
    downs = [max(y for _, y, _ in pts) for pts in projected]
    room = cell * (1 - 2 * MARGIN)
    px_per_in = min(room / max(spans_x), room / (max(ups) + max(downs)))
    floor_row = cell * (1 - MARGIN) - max(downs) * px_per_in

    image = Image.new("RGB", size, "white")
    draw = ImageDraw.Draw(image)
    big, small = font(round(cell * 0.047)), font(round(cell * 0.031))
    out = []
    for panel, pts, (cx, cy, cw, ch) in zip(panels, projected, cells):
        origin = (cx + cw / 2, cy + floor_row)
        to_px = lambda x, y: (origin[0] + x * px_per_in, origin[1] + y * px_per_in)  # noqa: E731
        faces = []
        for name, quad in QUADS.items():
            if project(panel["azimuth"], altitude, *NORMALS[name])[2] <= 1e-6:
                continue
            poly = [to_px(pts[i][0], pts[i][1]) for i in quad]
            depth = sum(pts[i][2] for i in quad) / 4
            tone = FRONT_TINT if name == "front" else (FACE_TINT.get(name, 200),) * 3
            faces.append((depth, poly, tone))
        xs = [to_px(x, y)[0] for x, y, _ in pts]
        ys = [to_px(x, y)[1] for x, y, _ in pts]
        rect = [int(math.floor(min(xs))), int(math.floor(min(ys))), int(math.ceil(max(xs))), int(math.ceil(max(ys)))]
        finished = bool(panel.get("photo"))
        clay = bool(panel.get("clay")) and not finished
        if finished:
            paste_photo(image, panel["photo"], panel.get("flip"), rect)
        elif clay:
            # A render of the piece's 3D model at this exact angle, for the model to paint over.
            paste_photo(image, panel["clay"], False, rect)
        else:
            for _, poly, tone in sorted(faces, key=lambda f: f[0]):
                draw.polygon(poly, fill=tone, outline=EDGE, width=2)
        draw.rectangle([cx, cy, cx + cw - 1, cy + ch - 1], outline=(120, 120, 120), width=3)
        draw.text((cx + 16, cy + 12), f"{len(out) + 1}", font=big, fill=(20, 20, 20))
        suffix = " (done)" if finished else " (clay)" if clay else ""
        draw.text((cx + 52, cy + 18), panel["label"] + suffix, font=small, fill=(20, 20, 20))
        out.append({"angle": panel["angle"], "cell": [cx, cy, cw, ch], "box": rect, "finished": finished, "clay": clay})
    image.save(out_path)
    return {"size": list(size), "panels": out}


def blobs(sheet, cell_px):
    """Bounding boxes of the pieces drawn on a sheet, ignoring thin grid lines."""
    dark = (sheet.min(axis=2) < 232).astype(np.uint8)
    k = max(3, int(cell_px * 0.012)) | 1
    dark = cv2.morphologyEx(dark, cv2.MORPH_OPEN, np.ones((k, k), np.uint8))  # drops border lines
    k = max(3, int(cell_px * 0.06)) | 1
    dark = cv2.dilate(dark, np.ones((k, k), np.uint8))  # joins legs and cushions into one blob
    n, _, stats, centers = cv2.connectedComponentsWithStats(dark)
    out = []
    for i in range(1, n):
        x, y, w, h, area = stats[i]
        if w < cell_px * 0.15 or h < cell_px * 0.1:
            continue
        out.append({"box": (int(x), int(y), int(x + w), int(y + h)), "center": (float(centers[i][0]), float(centers[i][1]))})
    return out


def split(sheet_path, panels, guide_size, matte, out_dir):
    """Cut a generated sheet into its views and matte each one.

    Each panel takes the nearest unclaimed piece on the sheet: inside its own
    cell when the model kept the layout, or the closest one on the same row
    when it recentered a short row. Panels with nothing are reported as empty.
    """
    sheet = cv2.imread(str(sheet_path), cv2.IMREAD_COLOR)
    if sheet is None:
        raise ValueError("cannot read the generated sheet")
    sx, sy = sheet.shape[1] / guide_size[0], sheet.shape[0] / guide_size[1]
    cell_px = panels[0]["cell"][2] * sx if panels else 640
    found = blobs(sheet, cell_px)
    pad = int(cell_px * 0.03)
    written, empty = {}, []
    for panel in panels:
        cx, cy, cw, ch = panel["cell"]
        center = ((cx + cw / 2) * sx, (cy + ch / 2) * sy)
        best = None
        for blob in found:
            if blob.get("taken"):
                continue
            dx, dy = blob["center"][0] - center[0], blob["center"][1] - center[1]
            if abs(dy) > ch * sy * 0.5:
                continue
            if best is None or abs(dx) < best[0]:
                best = (abs(dx), blob)
        if best is None or best[0] > cw * sx * 1.1:
            if not panel.get("finished"):
                empty.append(panel["angle"])
            continue
        blob = best[1]
        blob["taken"] = True
        if panel.get("finished"):
            continue  # a real photo's panel: claimed so no one else grabs it, not re-cut
        x0, y0, x1, y1 = blob["box"]
        x0, y0 = max(0, x0 - pad), max(0, y0 - pad)
        x1, y1 = min(sheet.shape[1], x1 + pad), min(sheet.shape[0], y1 + pad)
        try:
            rgba = matte.cut(np.ascontiguousarray(sheet[y0:y1, x0:x1]))
        except ValueError:
            empty.append(panel["angle"])
            continue
        path = out_dir / f"{panel['angle']}.png"
        cv2.imwrite(str(path), rgba)
        written[panel["angle"]] = {"path": str(path), "width": int(rgba.shape[1]), "height": int(rgba.shape[0])}
    return {"views": written, "empty": empty}
