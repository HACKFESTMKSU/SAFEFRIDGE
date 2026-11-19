"""Download Ultralytics weights into the image WORKDIR during Docker build."""

from __future__ import annotations

import os
import sys
from pathlib import Path

from ultralytics import YOLO


def main() -> int:
    raw = os.environ.get("PREFETCH_MODELS", "yolov8n.pt")
    names = [n.strip() for n in raw.split() if n.strip()]
    if not names:
        print("No models to prefetch", flush=True)
        return 0

    for name in names:
        print(f"Prefetching {name} …", flush=True)
        YOLO(name)
        path = Path(name)
        if not path.is_file():
            print(f"ERROR: expected weights at {path.resolve()}", file=sys.stderr)
            return 1
        print(f"  OK {path.resolve()} ({path.stat().st_size // 1024} KiB)", flush=True)

    print("Prefetch complete:", ", ".join(names), flush=True)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
