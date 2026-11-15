"""Seed login users + lab device/asset only. No fake telemetry or incidents."""

from sqlalchemy import select
from sqlalchemy.orm import Session

from .auth import hash_password
from .models import Asset, Device, User

SEED_USERS = [
    ("u-admin", "admin@coldguard.local", "Amina Admin", "+254700000001", "admin", "admin123"),
    ("u-operator", "operator@coldguard.local", "Owen Operator", "+254700000002", "operator", "operator123"),
    ("u-tech", "tech@coldguard.local", "Tessa Technician", "+254700000003", "technician", "tech123"),
]


def _ensure_demo_users(db: Session) -> None:
    """Create or refresh accounts so login emails match the UI."""
    for uid, email, name, phone, role, pw in SEED_USERS:
        legacy = email.replace("@coldguard.local", "@coldguard.app")
        user = (
            db.get(User, uid)
            or db.scalar(select(User).where(User.email == email))
            or db.scalar(select(User).where(User.email == legacy))
        )
        if user is None:
            db.add(
                User(
                    id=uid,
                    email=email,
                    name=name,
                    phone=phone,
                    role=role,
                    password_hash=hash_password(pw),
                )
            )
            continue
        user.email = email
        user.name = name
        user.phone = phone
        user.role = role
        user.password_hash = hash_password(pw)


def _ensure_lab_device(db: Session) -> None:
    """Ensure CG-001 exists and is linked to Pharmacy Fridge A (empty readings)."""
    if db.get(Device, "CG-001") is None:
        db.add(
            Device(
                id="CG-001",
                name="ESP32 · Lab DHT11",
                firmware_version="0.1.0",
                online=False,
                asset_id="ast-001",
                last_seen=None,
            )
        )
        db.flush()

    if db.get(Asset, "ast-001") is None:
        db.add(
            Asset(
                id="ast-001",
                name="Pharmacy Fridge A",
                type="refrigerator",
                location="Hackathon lab",
                status="active",
                device_id="CG-001",
                sms_recipients=["+254700000002"],
                temp_min_c=2,
                temp_max_c=8,
                temp_warning_c=7,
                temp_critical_c=10,
                humidity_max_percent=70,
                water_wet_threshold=500,
                current_min_a=0.3,
            )
        )
    else:
        asset = db.get(Asset, "ast-001")
        if asset is not None:
            asset.device_id = "CG-001"


def seed(db: Session) -> None:
    _ensure_demo_users(db)
    _ensure_lab_device(db)
    db.commit()
