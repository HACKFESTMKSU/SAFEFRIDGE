"""Model -> API schema mappers."""

from . import schemas
from .models import Asset, Device, Incident, MaintenanceNote, Telemetry, User


def user_out(u: User) -> schemas.UserOut:
    return schemas.UserOut(
        id=u.id, email=u.email, name=u.name, phone=u.phone, role=u.role, password=""
    )


def thresholds_out(a: Asset) -> schemas.Thresholds:
    return schemas.Thresholds(
        temp_min_c=a.temp_min_c,
        temp_max_c=a.temp_max_c,
        temp_warning_c=a.temp_warning_c,
        temp_critical_c=a.temp_critical_c,
        humidity_max_percent=a.humidity_max_percent,
        water_wet_threshold=a.water_wet_threshold,
        current_min_a=a.current_min_a,
    )


def asset_out(a: Asset) -> schemas.AssetOut:
    return schemas.AssetOut(
        id=a.id,
        name=a.name,
        type=a.type,
        location=a.location,
        status=a.status,
        thresholds=thresholds_out(a),
        device_id=a.device_id,
        sms_recipients=a.sms_recipients or [],
        product_key=getattr(a, "product_key", None),
        detection_confidence=getattr(a, "detection_confidence", None),
        last_detection_at=getattr(a, "last_detection_at", None),
        detection_source=getattr(a, "detection_source", None),
        agent_notes=getattr(a, "agent_notes", None),
    )


def device_out(d: Device) -> schemas.DeviceOut:
    return schemas.DeviceOut(
        id=d.id,
        name=d.name,
        firmware_version=d.firmware_version,
        online=d.online,
        last_seen=d.last_seen,
        asset_id=d.asset_id,
    )


def telemetry_out(t: Telemetry) -> schemas.TelemetryReading:
    return schemas.TelemetryReading(
        timestamp=t.timestamp,
        temperature_c=t.temperature_c,
        humidity_percent=t.humidity_percent,
        current_a=t.current_a,
        water_level=t.water_level,
        water_wet=t.water_wet,
        quality=t.quality,
    )


def incident_out(i: Incident) -> schemas.IncidentOut:
    return schemas.IncidentOut(
        id=i.id,
        asset_id=i.asset_id,
        type=i.type,
        severity=i.severity,
        status=i.status,
        title=i.title,
        message=i.message,
        recommended_action=i.recommended_action,
        detected_at=i.detected_at,
        acknowledged_at=i.acknowledged_at,
        acknowledged_by=i.acknowledged_by,
        resolved_at=i.resolved_at,
        resolved_by=i.resolved_by,
        resolve_note=i.resolve_note,
        value=i.value,
        threshold=i.threshold,
    )


def note_out(n: MaintenanceNote) -> schemas.NoteOut:
    return schemas.NoteOut(
        id=n.id,
        asset_id=n.asset_id,
        incident_id=n.incident_id,
        author_id=n.author_id,
        author_name=n.author_name,
        body=n.body,
        created_at=n.created_at,
    )
