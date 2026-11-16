"""MQTT ingest: subscribes to coldguard/device/{id}/telemetry|status (SRS §7),
validates payloads, stores Telemetry rows, updates Device state, runs rules."""

import json
import logging
import threading
from datetime import datetime, timezone

from pydantic import BaseModel, Field, field_validator
from sqlalchemy import select
from sqlalchemy.orm import Session

from .config import settings
from .database import SessionLocal
from .models import Device, Telemetry, utcnow
from . import rules

logger = logging.getLogger("coldguard.mqtt")

# Plausibility windows (FR-13): outside -> stored with quality='suspect'
RANGES = {
    "temperature_c": (-40.0, 80.0),
    "humidity_percent": (0.0, 100.0),
    "current_a": (-1.0, 50.0),
    "water_level": (0.0, 100000.0),
}


class TelemetryPayload(BaseModel):
    device_id: str = Field(alias="device_id")
    timestamp: datetime | None = None
    temperature_c: float | None = None
    humidity_percent: float | None = None
    current_a: float | None = None
    water_level: float | None = None
    water_wet: bool = False
    firmware_version: str | None = None

    model_config = {"populate_by_name": True}

    @field_validator("timestamp", mode="before")
    @classmethod
    def _parse_ts(cls, v):
        if isinstance(v, str):
            return datetime.fromisoformat(v.replace("Z", "+00:00"))
        return v


class StatusPayload(BaseModel):
    device_id: str | None = Field(default=None, alias="device_id")
    online: bool | None = None
    firmware_version: str | None = Field(default=None, alias="firmware_version")
    timestamp: datetime | None = None

    model_config = {"populate_by_name": True}


def _quality(payload: TelemetryPayload) -> str:
    for field, (lo, hi) in RANGES.items():
        value = getattr(payload, field)
        if value is not None and not (lo <= value <= hi):
            logger.warning("Implausible %s=%s on %s", field, value, payload.device_id)
            return "suspect"
    return "ok"


def handle_telemetry(payload: TelemetryPayload) -> None:
    with SessionLocal() as db:
        device = db.get(Device, payload.device_id)
        if device is None:
            device = Device(id=payload.device_id, name=payload.device_id)
            db.add(device)
            logger.info("Auto-registered device %s", payload.device_id)

        ts = payload.timestamp or utcnow()
        if ts.tzinfo is None:
            ts = ts.replace(tzinfo=timezone.utc)

        row = Telemetry(
            device_id=payload.device_id,
            timestamp=ts,
            temperature_c=payload.temperature_c,
            humidity_percent=payload.humidity_percent,
            current_a=payload.current_a,
            water_level=payload.water_level,
            water_wet=payload.water_wet,
            quality=_quality(payload),
        )
        db.add(row)

        device.last_seen = ts
        device.online = True
        if payload.firmware_version:
            device.firmware_version = payload.firmware_version
        db.commit()
        db.refresh(row)
        db.refresh(device)

        rules.clear_offline_incidents(db, device)
        rules.evaluate_telemetry(db, device, row)


def handle_status(payload: StatusPayload, device_id_from_topic: str) -> None:
    with SessionLocal() as db:
        device = db.get(Device, device_id_from_topic)
        if device is None:
            return
        if payload.online is not None:
            device.online = payload.online
            if payload.online:
                device.last_seen = utcnow()
        if payload.firmware_version:
            device.firmware_version = payload.firmware_version
        db.commit()


def _on_message(client, userdata, msg):
    topic = msg.topic
    try:
        raw = json.loads(msg.payload.decode("utf-8"))
        parts = topic.split("/")
        device_id = parts[2] if len(parts) > 2 else raw.get("device_id", "")
        if topic.endswith("/telemetry"):
            handle_telemetry(TelemetryPayload.model_validate(raw))
        elif topic.endswith("/status"):
            handle_status(StatusPayload.model_validate(raw), device_id)
    except Exception as exc:
        logger.warning("Bad MQTT message on %s: %s", topic, exc)


def _on_connect(client, userdata, flags, rc, properties=None):
    if rc == 0:
        client.subscribe("coldguard/device/+/telemetry")
        client.subscribe("coldguard/device/+/status")
        logger.info("MQTT connected to %s:%s", settings.MQTT_HOST, settings.MQTT_PORT)
    else:
        logger.error("MQTT connect failed, rc=%s", rc)


def start_mqtt() -> threading.Thread | None:
    """Start the paho subscriber in a daemon thread. Returns None if disabled."""
    if not settings.MQTT_ENABLED:
        logger.info("MQTT ingest disabled (MQTT_ENABLED=false)")
        return None
    try:
        import paho.mqtt.client as mqtt
    except ImportError:
        logger.error("paho-mqtt not installed; MQTT ingest disabled")
        return None

    client = mqtt.Client(mqtt.CallbackAPIVersion.VERSION2)
    if settings.MQTT_USERNAME:
        client.username_pw_set(settings.MQTT_USERNAME, settings.MQTT_PASSWORD)
    client.on_connect = _on_connect
    client.on_message = _on_message
    client.reconnect_delay_set(min_delay=1, max_delay=30)

    def _run():
        while True:
            try:
                client.connect(settings.MQTT_HOST, settings.MQTT_PORT, keepalive=60)
                client.loop_forever()
            except Exception as exc:
                logger.warning("MQTT connection lost: %s — retrying", exc)
                import time

                time.sleep(5)

    t = threading.Thread(target=_run, name="mqtt-ingest", daemon=True)
    t.start()
    return t
