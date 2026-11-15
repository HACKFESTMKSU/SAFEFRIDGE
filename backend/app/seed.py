"""Seed data mirroring web/src/data/mock.ts so the UI has realistic data."""

import math
import random
from datetime import datetime, timedelta, timezone

from sqlalchemy import select
from sqlalchemy.orm import Session

from .auth import hash_password
from .models import Asset, Device, Incident, MaintenanceNote, Telemetry, User

SEED_USERS = [
    ("u-admin", "admin@coldguard.local", "Amina Admin", "+254700000001", "admin", "admin123"),
    ("u-operator", "operator@coldguard.local", "Owen Operator", "+254700000002", "operator", "operator123"),
    ("u-tech", "tech@coldguard.local", "Tessa Technician", "+254700000003", "technician", "tech123"),
]

SEED_ASSETS = [
    dict(
        id="ast-001", name="Pharmacy Fridge A", type="refrigerator",
        location="Dispensary · Shelf 2", status="active", device_id="CG-001",
        sms_recipients=["+254700000002"],
        temp_min_c=2, temp_max_c=8, temp_warning_c=7, temp_critical_c=10,
        humidity_max_percent=70, water_wet_threshold=500, current_min_a=0.3,
    ),
    dict(
        id="ast-002", name="Vaccine Freezer B", type="freezer",
        location="Cold room · Bay 1", status="active", device_id="CG-002",
        sms_recipients=["+254700000002", "+254700000001"],
        temp_min_c=-25, temp_max_c=-15, temp_warning_c=-14, temp_critical_c=-10,
        humidity_max_percent=80, water_wet_threshold=500, current_min_a=0.4,
    ),
    dict(
        id="ast-003", name="Lab Cold Box", type="cold_box",
        location="Lab annex", status="maintenance", device_id=None,
        sms_recipients=["+254700000002"],
        temp_min_c=2, temp_max_c=8, temp_warning_c=7, temp_critical_c=10,
        humidity_max_percent=65, water_wet_threshold=400, current_min_a=None,
    ),
]

SEED_DEVICES = [
    dict(id="CG-001", name="ESP32 · Pharmacy", firmware_version="0.1.0",
         online=True, asset_id="ast-001", last_seen_offset_min=-1),
    dict(id="CG-002", name="ESP32 · Freezer", firmware_version="0.1.0",
         online=False, asset_id="ast-002", last_seen_offset_hours=-2),
    dict(id="CG-003", name="ESP32 · Spare", firmware_version="0.1.0",
         online=False, asset_id=None, last_seen_offset_hours=-48),
]


def _series(hours: int, base_temp: float, drift: float = 0.0):
    """Same shape as mock.ts buildSeries(): one point every 15 minutes."""
    now = datetime.now(timezone.utc)
    points = []
    for i in range(hours * 60, -1, -15):
        t = now - timedelta(minutes=i)
        wave = math.sin(i / 40) * 0.6
        spike = drift if i < 40 else 0
        temp = round(base_temp + wave + spike, 1)
        water = 720 if (i < 30 and drift > 2) else 80 + random.random() * 40
        points.append(dict(
            timestamp=t,
            temperature_c=temp,
            humidity_percent=round(55 + math.sin(i / 55) * 6),
            bmp_temperature_c=round(24 + math.sin(i / 70) * 1.2, 1),
            pressure_hpa=round(1012 + math.sin(i / 90) * 2, 1),
            current_a=round(1.1 + max(0, math.sin(i / 25)) * 0.8, 2),
            water_level=round(water),
            water_wet=water > 500,
            mq3_raw=round(40 + random.random() * 20),
            quality="ok",
        ))
    return points


def seed(db: Session) -> None:
    if db.scalar(select(User).limit(1)) is not None:
        return  # already seeded

    for uid, email, name, phone, role, pw in SEED_USERS:
        db.add(User(id=uid, email=email, name=name, phone=phone, role=role,
                    password_hash=hash_password(pw)))

    for a in SEED_ASSETS:
        db.add(Asset(**a))

    now = datetime.now(timezone.utc)
    for d in SEED_DEVICES:
        if d.get("last_seen_offset_min") is not None:
            last_seen = now + timedelta(minutes=d["last_seen_offset_min"])
        else:
            last_seen = now + timedelta(hours=d["last_seen_offset_hours"])
        db.add(Device(
            id=d["id"], name=d["name"], firmware_version=d["firmware_version"],
            online=d["online"], asset_id=d["asset_id"], last_seen=last_seen,
        ))

    db.flush()
    for device_id, base, drift in (("CG-001", 4.2, 0), ("CG-002", -18.5, 8)):
        for p in _series(24, base, drift):
            db.add(Telemetry(device_id=device_id, **p))

    db.add(Incident(
        id="inc-001", asset_id="ast-002", type="temperature", severity="critical",
        status="open", title="Temperature above critical",
        message="Vaccine Freezer B reading −10.2°C (critical ≥ −10°C).",
        recommended_action="Check compressor power and door seal. Move critical stock if recovery stalls.",
        detected_at=now - timedelta(minutes=28), value=-10.2, threshold=-10,
    ))
    db.add(Incident(
        id="inc-002", asset_id="ast-002", type="device_offline", severity="warning",
        status="acknowledged", title="Device offline",
        message="CG-002 has not reported for over 2 hours.",
        recommended_action="Verify Wi-Fi near the unit. Check SIM800L SMS if a critical threshold may have fired offline.",
        detected_at=now - timedelta(hours=2),
        acknowledged_at=now - timedelta(minutes=50), acknowledged_by="u-operator",
    ))
    db.add(Incident(
        id="inc-003", asset_id="ast-001", type="water", severity="warning",
        status="resolved", title="Water sensor wet",
        message="Leak / condensate detected under Pharmacy Fridge A.",
        recommended_action="Inspect drip tray and floor for overflow; dry probe area.",
        detected_at=now - timedelta(hours=26),
        acknowledged_at=now - timedelta(hours=25), acknowledged_by="u-operator",
        resolved_at=now - timedelta(hours=24), resolved_by="u-operator",
        resolve_note="Emptied drip tray; sensor dry.", value=680, threshold=500,
    ))
    db.add(MaintenanceNote(
        id="note-001", asset_id="ast-002", incident_id="inc-001",
        author_id="u-tech", author_name="Tessa Technician",
        body="Condenser coils dusty — scheduled clean tomorrow morning.",
        created_at=now - timedelta(minutes=15),
    ))

    db.commit()
