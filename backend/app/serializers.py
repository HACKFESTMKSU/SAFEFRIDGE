from __future__ import annotations

from datetime import datetime, timezone

from .config import get_settings
from .models import Asset, Device, Incident, MaintenanceNote, Telemetry, User
from .schemas import (
    AssetOut,
    DeviceOut,
    IncidentOut,
    NoteOut,
    TelemetryOut,
    Thresholds,
    UserOut,
)

settings = get_settings()


def to_iso(dt: datetime | None) -> str | None:
    if dt is None:
        return None
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return dt.isoformat().replace("+00:00", "Z")


def user_out(user: User) -> UserOut:
    return UserOut(
        id=user.id,
        email=user.email,
        name=user.name,
        phone=user.phone or "",
        role=user.role,  # type: ignore[arg-type]
    )


def asset_out(asset: Asset) -> AssetOut:
    thresholds = Thresholds.model_validate(asset.thresholds or {})
    return AssetOut(
        id=asset.id,
        name=asset.name,
        type=asset.type,  # type: ignore[arg-type]
        location=asset.location,
        status=asset.status,  # type: ignore[arg-type]
        deviceId=asset.device_id,
        smsRecipients=list(asset.sms_recipients or []),
        thresholds=thresholds,
    )


def device_is_online(device: Device) -> bool:
    if not device.last_seen:
        return False
    last = device.last_seen
    if last.tzinfo is None:
        last = last.replace(tzinfo=timezone.utc)
    age = (datetime.now(timezone.utc) - last).total_seconds()
    return age <= settings.device_online_seconds


def device_out(device: Device) -> DeviceOut:
    return DeviceOut(
        id=device.id,
        name=device.name,
        firmwareVersion=device.firmware_version,
        online=device_is_online(device),
        lastSeen=to_iso(device.last_seen),
        assetId=device.asset_id,
    )


def telemetry_out(row: Telemetry) -> TelemetryOut:
    return TelemetryOut(
        timestamp=to_iso(row.timestamp) or "",
        temperature_c=row.temperature_c,
        humidity_percent=row.humidity_percent,
        bmp_temperature_c=row.bmp_temperature_c,
        pressure_hpa=row.pressure_hpa,
        current_a=row.current_a,
        water_level=row.water_level,
        water_wet=row.water_wet,
        mq3_raw=row.mq3_raw,
    )


def incident_out(inc: Incident) -> IncidentOut:
    return IncidentOut(
        id=inc.id,
        assetId=inc.asset_id,
        type=inc.type,  # type: ignore[arg-type]
        severity=inc.severity,  # type: ignore[arg-type]
        status=inc.status,  # type: ignore[arg-type]
        title=inc.title,
        message=inc.message,
        recommendedAction=inc.recommended_action,
        detectedAt=to_iso(inc.detected_at) or "",
        acknowledgedAt=to_iso(inc.acknowledged_at),
        acknowledgedBy=inc.acknowledged_by,
        resolvedAt=to_iso(inc.resolved_at),
        resolvedBy=inc.resolved_by,
        resolveNote=inc.resolve_note,
        value=inc.value,
        threshold=inc.threshold,
    )


def note_out(note: MaintenanceNote) -> NoteOut:
    return NoteOut(
        id=note.id,
        assetId=note.asset_id,
        incidentId=note.incident_id,
        authorId=note.author_id,
        authorName=note.author_name,
        body=note.body,
        createdAt=to_iso(note.created_at) or "",
    )
