"""Render a piece's views from a 3D model.

The model comes from an image-to-3D service (see src/lib/mesh.js). It is set
on the floor, turned so its front matches the real photos, stretched to the
piece's true inches, and photographed from the same camera the Studio assumes:
azimuth is how far the camera has walked around the piece from straight in
front, positive to the camera's right so the piece's left side shows on the
right of the photo; altitude is how far the camera looks down at the piece's
middle. Output is a trimmed RGBA PNG per view, ready for normalize().
"""

import os

os.environ.setdefault("PYOPENGL_PLATFORM", "egl")

import cv2  # noqa: E402
import numpy as np  # noqa: E402
import pyrender  # noqa: E402
import trimesh  # noqa: E402

RENDER_PX = 2048
PROBE_PX = 384
YFOV_DEG = 28.0
MARGIN = 1.08
ALPHA_FLOOR = 8

# How the model might be sitting when it arrives: which axis is up, and how
# far it is turned about the up axis from facing the camera.
UP_FIXES = {"y": np.eye(4), "z": trimesh.transformations.rotation_matrix(-np.pi / 2, [1, 0, 0])}
TURNS = [0, 90, 180, 270]


def load_meshes(glb_path):
    scene = trimesh.load(str(glb_path), force="scene")
    meshes = [g for g in scene.dump(concatenate=False) if isinstance(g, trimesh.Trimesh) and len(g.faces)]
    if not meshes:
        raise ValueError("the 3D model has no surfaces")
    return meshes


def transformed(meshes, matrix):
    out = []
    for m in meshes:
        c = m.copy()
        c.apply_transform(matrix)
        out.append(c)
    return out


def bounds_of(meshes):
    lo = np.min([m.bounds[0] for m in meshes], axis=0)
    hi = np.max([m.bounds[1] for m in meshes], axis=0)
    return lo, hi


def place(meshes, up, turn_deg, inches=None):
    """Stand the model on the floor at the origin, facing +Z, sized in inches."""
    # Make the model's up axis +Y, then turn it about that axis.
    fixed = transformed(meshes, UP_FIXES[up])
    fixed = transformed(fixed, trimesh.transformations.rotation_matrix(np.radians(turn_deg), [0, 1, 0]))
    lo, hi = bounds_of(fixed)
    center = (lo + hi) / 2
    size = np.maximum(hi - lo, 1e-6)
    scale = np.ones(3)
    if inches:
        scale = np.array([inches["width"], inches["height"], inches["depth"]]) / size
    else:
        scale[:] = 1 / size[1]
    matrix = np.eye(4)
    matrix[:3, :3] = np.diag(scale)
    matrix[:3, 3] = -center * scale + [0, size[1] * scale[1] / 2, 0]
    return transformed(fixed, matrix)


def look_at(eye, target, up=(0, 1, 0)):
    eye, target = np.asarray(eye, float), np.asarray(target, float)
    z = eye - target
    z /= np.linalg.norm(z)
    x = np.cross(up, z)
    x /= np.linalg.norm(x)
    y = np.cross(z, x)
    pose = np.eye(4)
    pose[:3, 0], pose[:3, 1], pose[:3, 2], pose[:3, 3] = x, y, z, eye
    return pose


def camera_pose(meshes, azimuth_deg, altitude_deg):
    lo, hi = bounds_of(meshes)
    center = (lo + hi) / 2
    radius = np.linalg.norm(hi - lo) / 2 * MARGIN
    distance = radius / np.sin(np.radians(YFOV_DEG) / 2)
    a, t = np.radians(azimuth_deg), np.radians(altitude_deg)
    direction = np.array([np.cos(t) * np.sin(a), np.sin(t), np.cos(t) * np.cos(a)])
    return look_at(center + direction * distance, center)


class Renderer:
    def __init__(self, meshes):
        self.scene = pyrender.Scene(bg_color=[0, 0, 0, 0], ambient_light=[0.45, 0.45, 0.45])
        for m in meshes:
            self.scene.add(pyrender.Mesh.from_trimesh(m, smooth=False))
        self.camera = self.scene.add(pyrender.PerspectiveCamera(yfov=np.radians(YFOV_DEG)), pose=np.eye(4))
        self.key = self.scene.add(pyrender.DirectionalLight(intensity=2.6), pose=np.eye(4))
        self.fill = self.scene.add(pyrender.DirectionalLight(intensity=1.2), pose=np.eye(4))
        self.rim = self.scene.add(pyrender.DirectionalLight(intensity=0.8), pose=np.eye(4))
        self.meshes = meshes
        self.offscreen = None
        self.size = None

    def close(self):
        if self.offscreen:
            self.offscreen.delete()
            self.offscreen = None

    def render(self, azimuth_deg, altitude_deg, px):
        if self.size != px:
            self.close()
            self.offscreen = pyrender.OffscreenRenderer(px, px)
            self.size = px
        lo, hi = bounds_of(self.meshes)
        center = (lo + hi) / 2
        pose = camera_pose(self.meshes, azimuth_deg, altitude_deg)
        self.scene.set_pose(self.camera, pose)
        # Studio light: key high and to the camera's left, fill low on its right, rim from behind.
        eye = pose[:3, 3]
        far = np.linalg.norm(eye - center) * 3
        self.scene.set_pose(self.key, look_at(center + unit(azimuth_deg - 35, altitude_deg + 35) * far, center))
        self.scene.set_pose(self.fill, look_at(center + unit(azimuth_deg + 55, altitude_deg + 10) * far, center))
        self.scene.set_pose(self.rim, look_at(center + unit(azimuth_deg + 160, 50) * far, center))
        flags = pyrender.RenderFlags.RGBA | pyrender.RenderFlags.SKIP_CULL_FACES
        color, _ = self.offscreen.render(self.scene, flags=flags)
        return color


def unit(azimuth_deg, altitude_deg):
    a, t = np.radians(azimuth_deg), np.radians(altitude_deg)
    return np.array([np.cos(t) * np.sin(a), np.sin(t), np.cos(t) * np.cos(a)])


def trim(rgba):
    ys, xs = np.nonzero(rgba[:, :, 3] > ALPHA_FLOOR)
    if not len(ys):
        raise ValueError("the render came out empty")
    return rgba[ys.min() : ys.max() + 1, xs.min() : xs.max() + 1]


def to_bgra(rgba):
    out = rgba.copy()
    out[:, :, :3] = rgba[:, :, 2::-1]
    return out


# ---- Choosing the orientation ----


THUMB = 64


def thumb(rgba):
    """Mask and color of a cutout at a fixed height, centered on a wide canvas."""
    rgba = trim(rgba)
    w = max(1, min(THUMB * 4, round(rgba.shape[1] * THUMB / rgba.shape[0])))
    small = cv2.resize(rgba.astype(np.float32), (w, THUMB), interpolation=cv2.INTER_AREA)
    mask = np.zeros((THUMB, THUMB * 4), np.float32)
    color = np.zeros((THUMB, THUMB * 4, 3), np.float32)
    x = (THUMB * 4 - w) // 2
    mask[:, x : x + w] = small[:, :, 3] / 255
    color[:, x : x + w] = small[:, :, :3]
    return mask, color


def likeness(a, b):
    """How alike two cutouts look: silhouette overlap at one height, and rough color."""
    mask_a, color_a = a
    mask_b, color_b = b
    both = np.minimum(mask_a, mask_b).sum()
    either = np.maximum(mask_a, mask_b).sum()
    iou = both / max(either, 1e-6)
    weight = np.minimum(mask_a, mask_b)
    color = (np.abs(color_a - color_b).mean(axis=2) * weight).sum() / max(weight.sum(), 1e-6) / 255
    return iou - 0.5 * color


def read_rgba(path):
    image = cv2.imread(str(path), cv2.IMREAD_UNCHANGED)
    if image is None:
        raise ValueError(f"cannot read {path}")
    if image.ndim == 2:
        image = cv2.cvtColor(image, cv2.COLOR_GRAY2BGRA)
    elif image.shape[2] == 3:
        image = cv2.cvtColor(image, cv2.COLOR_BGR2BGRA)
    out = image.copy()
    out[:, :, :3] = image[:, :, 2::-1]
    return out


def choose_orientation(meshes, refs, altitude_deg, azimuths):
    """Try every up axis and quarter turn; keep the one whose renders match the real photos."""
    targets = []
    for ref in refs:
        if ref["angle"] not in azimuths:
            continue
        rgba = read_rgba(ref["path"])
        if ref.get("flip"):
            rgba = np.ascontiguousarray(rgba[:, ::-1])
        targets.append((azimuths[ref["angle"]], thumb(rgba)))
    if not targets:
        return "y", 0, {}
    scores = {}
    for up in UP_FIXES:
        for turn in TURNS:
            placed = place(meshes, up, turn)
            renderer = Renderer(placed)
            try:
                total = 0.0
                for azimuth, target in targets:
                    total += likeness(thumb(renderer.render(azimuth, altitude_deg, PROBE_PX)), target)
            finally:
                renderer.close()
            scores[f"{up}:{turn}"] = round(float(total) / len(targets), 4)
    best = max(scores, key=scores.get)
    up, turn = best.split(":")
    return up, int(turn), scores


def render_views(glb_path, out_dir, angles, azimuths, altitude_deg, inches, refs, up=None, turn=None):
    meshes = load_meshes(glb_path)
    scores = {}
    if up is None or turn is None:
        found_up, found_turn, scores = choose_orientation(meshes, refs, altitude_deg, azimuths)
        up = up or found_up
        turn = found_turn if turn is None else turn
    placed = place(meshes, up, turn, inches)
    renderer = Renderer(placed)
    written = {}
    try:
        for angle in angles:
            if angle not in azimuths:
                raise ValueError(f"cannot render a {angle} view")
            rgba = trim(renderer.render(azimuths[angle], altitude_deg, RENDER_PX))
            path = out_dir / f"{angle}.png"
            cv2.imwrite(str(path), to_bgra(rgba))
            written[angle] = {"path": str(path), "width": int(rgba.shape[1]), "height": int(rgba.shape[0])}
    finally:
        renderer.close()
    return {"views": written, "up": up, "turn": turn, "scores": scores}
