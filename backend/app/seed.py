"""Seed login users + lab device/asset only. No fake telemetry or incidents."""

from sqlalchemy import select
from sqlalchemy.orm import Session

from .auth import hash_password
from .models import Asset, Device, Incident, User, utcnow

SEED_USERS = [
    ("u-admin", "admin@coldguard.local", "Amina Admin", "+254700000001", "admin", "admin123"),
    ("u-operator", "operator@coldguard.local", "Owen Operator", "+254700000002", "operator", "operator123"),
    ("u-tech", "tech@coldguard.local", "Tessa Technician", "+254700000003", "technician", "tech123"),
]

# Ambient lab band: same units the Arduino publishes (°C, humidity %, water 0–100%).
LAB_THRESHOLDS = dict(
    temp_min_c=18.0,
    temp_max_c=28.0,
    temp_warning_c=30.0,
    temp_critical_c=35.0,
    humidity_max_percent=80.0,
    water_wet_threshold=25.0,
    current_min_a=None,
)


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


def _apply_lab_thresholds(asset: Asset) -> bool:
    """Overwrite fridge-band thresholds with ambient lab values. Returns True if changed."""
    changed = False
    for key, value in LAB_THRESHOLDS.items():
        if getattr(asset, key) != value:
            setattr(asset, key, value)
            changed = True
    return changed


def _resolve_stale_lab_incidents(db: Session, asset_id: str) -> None:
    """Close false temp/humidity alarms left over from the old 2–8°C fridge band."""
    now = utcnow()
    open_rows = db.scalars(
        select(Incident).where(
            Incident.asset_id == asset_id,
            Incident.type.in_(["temperature", "humidity"]),
            Incident.status.in_(["open", "acknowledged"]),
        )
    ).all()
    for inc in open_rows:
        inc.status = "resolved"
        inc.resolved_at = now
        inc.resolved_by = "u-admin"
        inc.resolve_note = "Auto-resolved: lab thresholds updated to match DHT11 ambient readings."


def _ensure_lab_device(db: Session) -> None:
    """Ensure CG-001 exists and every linked asset uses ambient lab thresholds."""
    device = db.get(Device, "CG-001")
    if device is None:
        device = Device(
            id="CG-001",
            name="ESP32 · Lab DHT11 + water",
            firmware_version="0.2.0-arduino",
            online=False,
            asset_id="ast-001",
            last_seen=None,
        )
        db.add(device)
        db.flush()
    else:
        device.name = "ESP32 · Lab DHT11 + water"
        if not device.firmware_version or device.firmware_version.startswith("0.1"):
            device.firmware_version = "0.2.0-arduino"

    # Prefer the asset linked to CG-001; fall back to ast-001.
    assets: list[Asset] = list(
        db.scalars(select(Asset).where(Asset.device_id == "CG-001")).all()
    )
    if not assets:
        asset = db.get(Asset, "ast-001")
        if asset is None:
            asset = Asset(
                id="ast-001",
                name="Lab produce storehouse",
                type="warehouse",
                location="Hackathon lab · food hub demo",
                status="active",
                device_id="CG-001",
                sms_recipients=["+254700000002"],
                **LAB_THRESHOLDS,
            )
            db.add(asset)
            db.flush()
            assets = [asset]
        else:
            assets = [asset]

    for asset in assets:
        asset.device_id = "CG-001"
        # Keep a clear lab name if this is still the seeded pharmacy placeholder.
        if asset.id == "ast-001" or asset.name in (
            "Pharmacy Fridge A",
            "Lab sensor unit",
            "Lab produce storehouse",
        ):
            asset.name = "Lab produce storehouse"
            asset.type = "warehouse"
            asset.location = "Hackathon lab · food hub demo"
        changed = _apply_lab_thresholds(asset)
        if changed:
            _resolve_stale_lab_incidents(db, asset.id)

    device.asset_id = assets[0].id


def seed(db: Session) -> None:
    _ensure_demo_users(db)
    _ensure_lab_device(db)
    db.commit()
