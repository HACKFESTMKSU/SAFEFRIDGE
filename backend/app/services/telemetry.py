from __future__ import annotations

import logging
from datetime import datetime, timezone

from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from ..models import Device, Telemetry
from ..schemas import TelemetryIngest

logger = logging.getLogger("coldguard.telemetry")


def parse_timestamp(value: datetime | str | None) -> datetime:
    if value is None:
        return datetime.now(timezone.utc)
    if isinstance(value, datetime):
        dt = value
    else:
        text = value.replace("Z", "+00:00")
        dt = datetime.fromisoformat(text)
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return dt


def validate_dht11(temp: float | None, humidity: float | None) -> str:
    """Return quality flag for DHT11-focused ingest."""
    if temp is None and humidity is None:
        return "empty"
    if temp is not None and (temp < -40 or temp > 80):
        return "implausible"
    if humidity is not None and (humidity < 0 or humidity > 100):
        return "implausible"
    return "ok"


def ensure_device(db: Session, device_id: str, firmware_version: str | None = None) -> Device:
    device = db.get(Device, device_id)
    if not device:
        device = Device(
            id=device_id,
            name=f"ESP32 · {device_id}",
            firmware_version=firmware_version or "0.1.0",
        )
        db.add(device)
        db.flush()
        logger.info("Auto-registered device %s", device_id)
    elif firmware_version:
        device.firmware_version = firmware_version
    return device


def ingest_telemetry(db: Session, payload: TelemetryIngest) -> Telemetry | None:
    ts = parse_timestamp(payload.timestamp)
    quality = validate_dht11(payload.temperature_c, payload.humidity_percent)

    device = ensure_device(db, payload.device_id, payload.firmware_version)
    device.last_seen = datetime.now(timezone.utc)

    row = Telemetry(
        device_id=payload.device_id,
        timestamp=ts,
        temperature_c=payload.temperature_c,
        humidity_percent=payload.humidity_percent,
        bmp_temperature_c=payload.bmp_temperature_c,
        pressure_hpa=payload.pressure_hpa,
        current_a=payload.current_a,
        water_level=payload.water_level,
        water_wet=payload.water_wet,
        mq3_raw=payload.mq3_raw,
        quality=quality,
        raw=payload.model_dump(mode="json"),
    )
    db.add(row)
    try:
        db.commit()
        db.refresh(row)
        return row
    except IntegrityError:
        db.rollback()
        logger.debug("Duplicate telemetry ignored for %s @ %s", payload.device_id, ts)
        return None
