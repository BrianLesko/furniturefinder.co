"""Local room-layout service for the site.

POST /layout?variant=mp3d with the photo's bytes as the body returns the
uLayout ceiling and floor boundaries in that photo's pixels, plus the snapped
segments, uprights and back wall from snap.py. The floor line is MoGe's plane
through the floor SegFormer labels. SegFormer's own edge is the fallback.
The models load once at start and requests run one at a time on the GPU.

    .venv/bin/python serve.py [--port 6021]
"""

import argparse
import json
import threading
import time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import parse_qs, urlparse

import cv2
import numpy as np

from camera import camera_check
from floor_plane import FloorPlane
from floor_seg import FloorSeg
from snap import snap_layout
from ulayout_photo import Layout

MAX_BYTES = 40 * 1024 * 1024


def make_handler(layout, floors, plane, lock):
    class Handler(BaseHTTPRequestHandler):
        def send(self, status, body):
            data = json.dumps(body).encode()
            self.send_response(status)
            self.send_header("Content-Type", "application/json")
            self.send_header("Content-Length", str(len(data)))
            self.end_headers()
            self.wfile.write(data)

        def do_GET(self):
            if self.path == "/health":
                self.send(200, {"ok": True, "device": layout.device.type, "variants": layout.available()})
            else:
                self.send(404, {"error": "Not found."})

        def do_POST(self):
            url = urlparse(self.path)
            if url.path != "/layout":
                return self.send(404, {"error": "Not found."})
            variant = parse_qs(url.query).get("variant", ["mp3d"])[0]
            if variant not in layout.available():
                return self.send(400, {"error": f"No {variant} checkpoint in ml/weights."})
            length = int(self.headers.get("Content-Length") or 0)
            if not length or length > MAX_BYTES:
                return self.send(413 if length else 400, {"error": "Send the photo as the request body."})
            raw = np.frombuffer(self.rfile.read(length), np.uint8)
            bgr = cv2.imdecode(raw, cv2.IMREAD_COLOR)
            if bgr is None:
                return self.send(400, {"error": "That is not an image this service can read."})
            started = time.perf_counter()
            rgb = cv2.cvtColor(bgr, cv2.COLOR_BGR2RGB)
            with lock:
                result = layout.infer(rgb, variant)
                # The retake check was tuned on uLayout's continuous line. The
                # studio scales and snaps against MoGe's plane, with SegFormer's
                # edge only when the plane finds too little floor.
                layout_floor = result["floor"]
                try:
                    labels = floors.labels_of(rgb)
                except Exception as exc:
                    print(f"floor seg failed: {exc}", flush=True)
                    labels = None
                moge = plane.line(rgb, result.get("calib", {}).get("gravity"), labels, floors.floor_ids)
                if moge:
                    result["floor"] = moge
                    result["floor_model"] = "moge"
                else:
                    floor = floors.line(rgb, layout_floor, result["ceiling"], result["horizon"], pred=labels)
                    if floor:
                        result["floor"] = floor
                        result["floor_model"] = "segformer"
            result["snap"] = snap_layout(rgb, result)
            result["camera"] = camera_check({**result, "floor": layout_floor})
            result["ms"] = round((time.perf_counter() - started) * 1000)
            self.send(200, result)

        def log_message(self, fmt, *args):
            print(f"{self.address_string()} {fmt % args}", flush=True)

    return Handler


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--host", default="127.0.0.1")
    parser.add_argument("--port", type=int, default=6021)
    args = parser.parse_args()
    layout = Layout()
    floors = FloorSeg(layout.device)
    plane = FloorPlane(layout.device)
    server = ThreadingHTTPServer((args.host, args.port), make_handler(layout, floors, plane, threading.Lock()))
    print(f"layout service on http://{args.host}:{args.port} ({layout.device.type})", flush=True)
    server.serve_forever()


if __name__ == "__main__":
    main()
