from __future__ import annotations

import json
import logging
import threading
from typing import Any

import paho.mqtt.client as mqtt

from .config import get_settings
from .db import SessionLocal
from .schemas import TelemetryIngest
from .services.telemetry import ingest_telemetry

logger = logging.getLogger("coldguard.mqtt")
settings = get_settings()


class MqttIngestWorker:
    def __init__(self) -> None:
        self._client: mqtt.Client | None = None
        self._thread: threading.Thread | None = None
        self._stop = threading.Event()

    def start(self) -> None:
        if self._thread and self._thread.is_alive():
            return
        self._stop.clear()
        self._thread = threading.Thread(target=self._run, name="mqtt-ingest", daemon=True)
        self._thread.start()

    def stop(self) -> None:
        self._stop.set()
        if self._client:
            try:
                self._client.disconnect()
            except Exception:  # noqa: BLE001
                pass
        if self._thread:
            self._thread.join(timeout=3)

    def _run(self) -> None:
        client = mqtt.Client(
            mqtt.CallbackAPIVersion.VERSION2,
            client_id="coldguard-backend",
        )
        self._client = client

        if settings.mqtt_username:
            client.username_pw_set(settings.mqtt_username, settings.mqtt_password)

        client.on_connect = self._on_connect
        client.on_message = self._on_message

        while not self._stop.is_set():
            try:
                logger.info(
                    "Connecting MQTT %s:%s",
                    settings.mqtt_host,
                    settings.mqtt_port,
                )
                client.connect(settings.mqtt_host, settings.mqtt_port, keepalive=60)
                client.loop_forever(retry_first_connection=True)
            except Exception as exc:  # noqa: BLE001
                logger.warning("MQTT disconnected/retry: %s", exc)
                self._stop.wait(5)

    def _on_connect(
        self,
        client: mqtt.Client,
        _userdata: Any,
        _flags: Any,
        reason_code: Any,
        _properties: Any = None,
    ) -> None:
        rc = getattr(reason_code, "value", reason_code)
        if rc != 0:
            logger.error("MQTT connect failed: %s", reason_code)
            return
        client.subscribe(settings.mqtt_telemetry_topic)
        client.subscribe(settings.mqtt_status_topic)
        logger.info(
            "MQTT subscribed: %s , %s",
            settings.mqtt_telemetry_topic,
            settings.mqtt_status_topic,
        )

    def _on_message(
        self,
        _client: mqtt.Client,
        _userdata: Any,
        msg: mqtt.MQTTMessage,
    ) -> None:
        try:
            payload = json.loads(msg.payload.decode("utf-8"))
        except (UnicodeDecodeError, json.JSONDecodeError) as exc:
            logger.warning("Bad MQTT payload on %s: %s", msg.topic, exc)
            return

        if msg.topic.endswith("/status"):
            self._handle_status(msg.topic, payload)
            return

        if not msg.topic.endswith("/telemetry"):
            return

        device_id = payload.get("device_id")
        if not device_id:
            parts = msg.topic.split("/")
            device_id = parts[2] if len(parts) >= 3 else None
        if not device_id:
            logger.warning("Telemetry missing device_id on %s", msg.topic)
            return

        try:
            ingest = TelemetryIngest(device_id=device_id, **{
                k: v for k, v in payload.items() if k != "device_id"
            })
        except Exception as exc:  # noqa: BLE001
            logger.warning("Invalid telemetry JSON: %s", exc)
            return

        db = SessionLocal()
        try:
            row = ingest_telemetry(db, ingest)
            if row:
                logger.info(
                    "Ingested %s temp=%s humidity=%s",
                    device_id,
                    ingest.temperature_c,
                    ingest.humidity_percent,
                )
        except Exception as exc:  # noqa: BLE001
            logger.exception("Ingest failed: %s", exc)
            db.rollback()
        finally:
            db.close()

    def _handle_status(self, topic: str, payload: dict[str, Any]) -> None:
        parts = topic.split("/")
        device_id = payload.get("device_id") or (parts[2] if len(parts) >= 3 else None)
        if not device_id:
            return
        from datetime import datetime, timezone

        from .models import Device

        db = SessionLocal()
        try:
            device = db.get(Device, device_id)
            if not device:
                device = Device(
                    id=device_id,
                    name=f"ESP32 · {device_id}",
                    firmware_version=str(payload.get("firmware_version") or "0.1.0"),
                )
                db.add(device)
            device.last_seen = datetime.now(timezone.utc)
            if payload.get("firmware_version"):
                device.firmware_version = str(payload["firmware_version"])
            db.commit()
        except Exception as exc:  # noqa: BLE001
            logger.warning("Status update failed: %s", exc)
            db.rollback()
        finally:
            db.close()


mqtt_worker = MqttIngestWorker()
