from __future__ import annotations

import logging

from sqlalchemy.orm import Session

from .models import Asset, Device, User
from .schemas import Thresholds
from .security import hash_password

logger = logging.getLogger("coldguard.seed")

DEFAULT_THRESHOLDS = Thresholds().model_dump()

SEED_USERS = [
    {
        "id": "u-admin",
        "email": "admin@coldguard.app",
        "name": "Amina Admin",
        "phone": "+254700000001",
        "role": "admin",
        "password": "admin123",
    },
    {
        "id": "u-operator",
        "email": "operator@coldguard.app",
        "name": "Owen Operator",
        "phone": "+254700000002",
        "role": "operator",
        "password": "operator123",
    },
    {
        "id": "u-tech",
        "email": "tech@coldguard.app",
        "name": "Tessa Technician",
        "phone": "+254700000003",
        "role": "technician",
        "password": "tech123",
    },
]


def seed_database(db: Session) -> None:
    created_users = 0
    for row in SEED_USERS:
        existing = db.get(User, row["id"])
        if existing:
            existing.email = row["email"]
            existing.name = row["name"]
            existing.phone = row["phone"]
            existing.role = row["role"]
            continue
        db.add(
            User(
                id=row["id"],
                email=row["email"],
                name=row["name"],
                phone=row["phone"],
                role=row["role"],
                password_hash=hash_password(row["password"]),
            )
        )
        created_users += 1

    device = db.get(Device, "CG-001")
    if not device:
        device = Device(
            id="CG-001",
            name="ESP32 · Lab DHT11",
            firmware_version="0.1.0",
            asset_id="ast-001",
        )
        db.add(device)
        logger.info("Seeded device CG-001")

    asset = db.get(Asset, "ast-001")
    if not asset:
        asset = Asset(
            id="ast-001",
            name="Lab Cold Unit",
            type="refrigerator",
            location="Hackathon lab",
            status="active",
            device_id="CG-001",
            sms_recipients=["+254700000002"],
            thresholds=DEFAULT_THRESHOLDS,
        )
        db.add(asset)
        logger.info("Seeded asset ast-001 linked to CG-001")

    db.commit()
    if created_users:
        logger.info("Seeded %s users", created_users)
