"""Gather photos for /straighten/vote into public/vote-set with a manifest.

Usage: .venv/bin/python vote_set.py [source_dir ...]
Each source dir becomes a group named after the folder. Photos are saved as
JPEG no wider than MAX_SIDE, so the page and the layout service see the same
pixels.
"""

import json
import sys
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "public" / "vote-set"
MAX_SIDE = 1536
EXTS = {".jpg", ".jpeg", ".png", ".webp"}


def main(sources):
    OUT.mkdir(parents=True, exist_ok=True)
    manifest_path = OUT / "manifest.json"
    manifest = json.loads(manifest_path.read_text()) if manifest_path.exists() else []
    batch = max((p.get("batch", 1) for p in manifest), default=0) + 1
    for source in map(Path, sources):
        group = source.name
        for path in sorted(source.rglob("*")):
            if path.suffix.lower() not in EXTS:
                continue
            pid = f"{group}-{len([p for p in manifest if p['group'] == group]) + 1:03d}"
            key = f"{group}/{path.relative_to(source)}"
            if any(p.get("from") == key for p in manifest):
                continue
            try:
                im = Image.open(path).convert("RGB")
            except OSError:
                continue
            im.thumbnail((MAX_SIDE, MAX_SIDE))
            im.save(OUT / f"{pid}.jpg", quality=90)
            manifest.append({"id": pid, "group": group, "src": f"/vote-set/{pid}.jpg", "from": key, "batch": batch})
    manifest_path.write_text(json.dumps(manifest, indent=1))
    print(len(manifest), "photos")


if __name__ == "__main__":
    main(sys.argv[1:])
