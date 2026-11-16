#!/usr/bin/env python3
"""One-shot: set CG-001 / lab asset thresholds to match Arduino ambient readings.

Run from the backend env (or Docker):
  python -m scripts.fix_lab_thresholds
"""

from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.database import SessionLocal
from app.seed import seed


def main() -> None:
    with SessionLocal() as db:
        seed(db)
        print("Lab thresholds applied (18–28°C, humidity max 80%, water wet ≥25%).")
        print("Restart is not required if the API process already uses this DB.")


if __name__ == "__main__":
    main()
