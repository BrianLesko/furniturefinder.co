"""Room layout lines for an ordinary listing photo, using uLayout.

uLayout predicts, for every column of a 360° image, the latitude of the
ceiling-wall and floor-wall boundaries. A perspective photo is fed to it the
way its LSUN training data was: squashed to 512², verticals aligned by the
vertical vanishing point, squashed again to 256² and pasted on the front face
of a cube, then rolled so the room's vertical middle sits on the equator.

Training rolled by ground truth, so here the first roll comes from the
GeoCalib horizon and the second from the first prediction's own ceiling and
floor. Output is the two boundaries as polylines in original photo pixels.

    .venv/bin/python ulayout_photo.py photo.webp [more...] --out out/
"""

import argparse
import json
import math
import os
import sys

import cv2
import numpy as np
import torch

HERE = os.path.dirname(os.path.abspath(__file__))
ULAYOUT = os.path.join(HERE, "vendor", "uLayout")
ALIGN = os.path.join(ULAYOUT, "preprocessing", "perspective", "alignment")


def _import_alignment():
    # uLayout and its alignment scripts each ship a top-level `utils` package.
    sys.path.insert(0, ALIGN)
    import utils.preproc_utils as preproc

    sys.path.remove(ALIGN)
    for key in [k for k in sys.modules if k == "utils" or k.startswith("utils.")]:
        sys.modules["align_" + key] = sys.modules.pop(key)
    return preproc


preproc = _import_alignment()
compute_homography_and_warp = preproc.compute_homography_and_warp
extract_edgelets = preproc.extract_edgelets
extract_z_vp = preproc.extract_z_vp
sys.path.insert(0, ULAYOUT)

from model.Swim_Transformer.lgt_net import LGT_Net  # noqa: E402
from utils.Cube2Equirec import Cube2Equirec  # noqa: E402

PANO_H, PANO_W = 512, 1024
FACE = 256
ALIGN_SIZE = 512
OUT_BOUND = math.radians(75)


# Each checkpoint pairs LSUN perspective photos with a different panorama set.
WEIGHTS = {
    "mp3d": "ulayout-mp3d.pth",
    "pano": "ulayout-pano.pth",
    "st2d3d": "ulayout-st2d3d.pth",
}


def load_net(device, variant="mp3d"):
    net = LGT_Net(
        output_name="Horizon", decoder_name="SWG_Transformer", win_size=16, depth=8, dropout=0.0, ape="lr_parameter"
    )
    state = torch.load(os.path.join(HERE, "weights", WEIGHTS[variant]), map_location="cpu", weights_only=False)
    net.load_state_dict(state["state_dict"])
    return net.to(device).eval()


def load_geocalib(device):
    from geocalib import GeoCalib

    return GeoCalib().to(device).eval()


def vertical_alignment(img512):
    """Homography taking the squashed photo to one whose verticals are vertical."""
    edgelets = extract_edgelets("photo", img512, "", 0.3, 10)
    vpz = extract_z_vp("photo", img512, np.zeros((0, 2)), np.zeros((0, 2)), "", edgelets, 5, 45, 3000)
    h, w = img512.shape[:2]
    rot = math.degrees(math.atan2(vpz[1] - h / 2, vpz[0] - w / 2))
    rot = abs(rot + 90) if rot < 0 else abs(rot - 90)
    if rot > 20:
        vpz = np.array([w / 2, 1e9, 1], np.float64)
    line = np.cross(vpz, np.array([(w - 1) / 2, (h - 1) / 2, 1]))
    aligned, H = compute_homography_and_warp(img512, vpz, np.array([line[0], line[1], 0]))
    return (aligned * 255).astype(np.uint8) if aligned.dtype != np.uint8 else aligned, H, vpz


def horizon_points(geocalib, rgb, device):
    """Points on the horizon, in original pixels, from GeoCalib's latitude field."""
    tensor = torch.from_numpy(rgb).permute(2, 0, 1).float().div(255).to(device)
    with torch.no_grad():
        out = geocalib.calibrate(tensor)
    lat = out["latitude_field"][0, 0].cpu().numpy()
    h, w = lat.shape
    pts = []
    for x in np.linspace(0.1 * w, 0.9 * w, 9).astype(int):
        col = lat[:, x]
        sign = np.where(np.diff(np.sign(col)) != 0)[0]
        if len(sign):
            y = sign[0]
            t = col[y] / (col[y] - col[y + 1])
            pts.append((x, y + t))
    roll = math.degrees(float(out["gravity"].rp[0, 0]))
    pitch = math.degrees(float(out["gravity"].rp[0, 1]))
    vfov = math.degrees(float(out["camera"].vfov[0]))
    # Gravity seen through the camera lands on the vertical vanishing point,
    # kept homogeneous so a level camera's point at infinity still works.
    g = out["gravity"].vec3d[0].cpu().numpy().astype(np.float64)
    f = float(out["camera"].f[0, 1])
    c = out["camera"].c[0].cpu().numpy().astype(np.float64)
    vp = [f * g[0] + c[0] * g[2], f * g[1] + c[1] * g[2], g[2]]
    return pts, {
        "pitch": pitch,
        "roll": roll,
        "vfov": vfov,
        "vp": vp,
        "f": f,
        "c": [float(c[0]), float(c[1])],
        "gravity": [float(v) for v in g],
    }


def apply_h(H, pts):
    p = np.c_[np.asarray(pts, np.float64), np.ones(len(pts))] @ H.T
    return p[:, :2] / p[:, 2:3]


def to_pano(face, c2e, device):
    faces = torch.zeros(6, 3, FACE, FACE)
    faces[2] = torch.from_numpy(face).permute(2, 0, 1)
    return c2e(faces.to(device))[0]


def roll_rows(pano, rows):
    return torch.roll(pano, shifts=int(rows), dims=1)


def predict(net, pano):
    with torch.no_grad():
        bon, _ = net(pano[None])
    return bon[0].cpu().numpy()


def face_columns():
    theta = (np.arange(PANO_W) / (PANO_W - 1) - 0.5) * 2 * np.pi
    cols = np.where(np.abs(theta) < np.pi / 4 - 1e-3)[0]
    return cols, theta[cols]


def boundary_to_face(phi, theta):
    x = np.sin(theta) * np.cos(phi)
    y = np.sin(phi)
    z = np.cos(theta) * np.cos(phi)
    f = FACE / 2
    return np.c_[f * x / z + (FACE - 1) / 2, f * y / z + (FACE - 1) / 2]


class Layout:
    def __init__(self):
        self.device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
        self.nets = {"mp3d": load_net(self.device)}
        self.geocalib = load_geocalib(self.device)
        self.c2e = Cube2Equirec(PANO_H, PANO_W, FACE, CUDA=self.device.type == "cuda")

    def available(self):
        return [v for v, f in WEIGHTS.items() if os.path.isfile(os.path.join(HERE, "weights", f))]

    def net(self, variant):
        if variant not in self.nets:
            self.nets[variant] = load_net(self.device, variant)
        return self.nets[variant]

    def infer(self, rgb, variant="mp3d"):
        """Ceiling and floor boundaries of an RGB uint8 photo, in its own pixels."""
        net = self.net(variant)
        H0, W0 = rgb.shape[:2]
        sx, sy = ALIGN_SIZE / W0, ALIGN_SIZE / H0

        img512 = cv2.resize(rgb, (ALIGN_SIZE, ALIGN_SIZE), interpolation=cv2.INTER_AREA)
        aligned, H, vpz = vertical_alignment(img512)
        Ha, Wa = aligned.shape[:2]
        face = cv2.resize(aligned, (FACE, FACE), interpolation=cv2.INTER_AREA).astype(np.float32) / 255
        pano = to_pano(face, self.c2e, self.device)

        hpts, calib = horizon_points(self.geocalib, rgb, self.device)
        if hpts:
            squashed = np.array(hpts) * [sx, sy]
            yh = apply_h(H, squashed)[:, 1].mean() * FACE / Ha
            lat0 = math.atan((yh - (FACE - 1) / 2) / (FACE / 2))
        else:
            lat0 = 0.0
        shift = -lat0 * PANO_H / np.pi

        cols, theta = face_columns()
        for _ in range(2):
            bon = predict(net, roll_rows(pano, shift))
            phi = bon - np.pi * shift / PANO_H
            ceiling = phi[0, cols]
            floor = phi[1, cols]
            middle = (ceiling.max() + floor.min()) / 2
            shift = -middle * PANO_H / np.pi

        Hinv = np.linalg.inv(H)
        lines = {}
        for name, row in (("ceiling", ceiling), ("floor", floor)):
            uv = boundary_to_face(row, theta)
            inside = (uv[:, 1] >= 0) & (uv[:, 1] <= FACE - 1)
            aligned_px = (uv + 0.5) * [Wa / FACE, Ha / FACE] - 0.5
            squashed = apply_h(Hinv, aligned_px)
            orig = (squashed + 0.5) / [sx, sy] - 0.5
            lines[name] = [[round(float(x), 1), round(float(y), 1)] for (x, y), ok in zip(orig, inside) if ok]

        return {
            "variant": variant,
            "width": W0,
            "height": H0,
            "calib": calib,
            "vpz": [float(v) for v in vpz],
            "horizon": [[round(float(x), 1), round(float(y), 1)] for x, y in hpts],
            **lines,
        }


def run(path, layout, out_dir, prefix_dir=False):
    bgr = cv2.imread(path, cv2.IMREAD_COLOR)
    if bgr is None:
        return None
    result = {"image": path, **layout.infer(cv2.cvtColor(bgr, cv2.COLOR_BGR2RGB))}
    W0 = result["width"]

    name = os.path.splitext(os.path.basename(path))[0]
    if prefix_dir:
        name = f"{os.path.basename(os.path.dirname(path))}__{name}"
    vis = bgr.copy()
    for key, color in (("ceiling", (255, 200, 0)), ("floor", (0, 140, 255))):
        pts = np.array(result[key], np.int32)
        if len(pts) > 1:
            cv2.polylines(vis, [pts], False, color, max(2, W0 // 400), cv2.LINE_AA)
    for x, y in result["horizon"]:
        cv2.circle(vis, (int(x), int(y)), max(3, W0 // 300), (0, 255, 0), -1)
    cv2.imwrite(os.path.join(out_dir, f"{name}.layout.jpg"), vis)
    with open(os.path.join(out_dir, f"{name}.layout.json"), "w") as f:
        json.dump(result, f)
    return result


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("images", nargs="+")
    parser.add_argument("--out", default=os.path.join(HERE, "out"))
    parser.add_argument("--prefix-dir", action="store_true", help="name outputs after the photo's folder too")
    args = parser.parse_args()
    os.makedirs(args.out, exist_ok=True)
    layout = Layout()
    for path in args.images:
        r = run(path, layout, args.out, args.prefix_dir)
        if r is None:
            print(f"{os.path.basename(path)}: unreadable, skipped")
            continue
        print(
            f"{os.path.basename(path)}: pitch {r['calib']['pitch']:.1f}°, vfov {r['calib']['vfov']:.0f}°, "
            f"ceiling {len(r['ceiling'])} pts, floor {len(r['floor'])} pts"
        )


if __name__ == "__main__":
    main()
