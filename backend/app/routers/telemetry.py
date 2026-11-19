from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import ValidationError
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from .. import mappers, schemas
from ..auth import get_current_user
from ..database import get_db
from ..models import Device, Telemetry, User
from ..mqtt_client import TelemetryPayload, handle_telemetry

router = APIRouter(prefix="/telemetry", tags=["telemetry"])


def _get_device(db: Session, device_id: str) -> Device:
    device = db.get(Device, device_id)
    if device is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Device not found")
    return device


@router.post("/ingest", status_code=status.HTTP_202_ACCEPTED)
def ingest_telemetry(body: dict):
    """Accept the same JSON the ESP32 publishes over MQTT (SRS §7).

    Useful when the Render service cannot reach a broker, or for curl/scripts.
    No auth — same trust model as an open lab MQTT topic.
    """
    try:
        payload = TelemetryPayload.model_validate(body)
    except ValidationError as exc:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, detail=exc.errors()) from exc
    handle_telemetry(payload)
    return {"status": "accepted", "device_id": payload.device_id}


@router.get("/{device_id}", response_model=list[schemas.TelemetryReading])
def get_telemetry(
    device_id: str,
    hours: float = Query(default=24, gt=0, le=24 * 30),
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    _get_device(db, device_id)
    since = datetime.now(timezone.utc) - timedelta(hours=hours)
    rows = db.scalars(
        select(Telemetry)
        .where(Telemetry.device_id == device_id, Telemetry.timestamp >= since)
        .order_by(Telemetry.timestamp.asc())
    ).all()
    return [mappers.telemetry_out(r) for r in rows]


@router.get("/{device_id}/latest", response_model=schemas.TelemetryReading | None)
def get_latest(
    device_id: str,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    _get_device(db, device_id)
    row = db.scalars(
        select(Telemetry)
        .where(Telemetry.device_id == device_id)
        .order_by(Telemetry.timestamp.desc())
        .limit(1)
    ).first()
    return mappers.telemetry_out(row) if row else None


@router.get("/{device_id}/stats", response_model=schemas.TelemetryStats)
def get_stats(
    device_id: str,
    hours: float = Query(default=24, gt=0, le=24 * 30),
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    _get_device(db, device_id)
    since = datetime.now(timezone.utc) - timedelta(hours=hours)
    base = select(func.count()).select_from(Telemetry).where(
        Telemetry.device_id == device_id, Telemetry.timestamp >= since
    )
    count = db.scalar(base) or 0

    def stats_for(column):
        row = db.execute(
            select(func.min(column), func.max(column), func.avg(column)).where(
                Telemetry.device_id == device_id,
                Telemetry.timestamp >= since,
                column.is_not(None),
            )
        ).first()
        if row is None or row[0] is None:
            return {"min": None, "max": None, "avg": None}
        return {
            "min": round(float(row[0]), 2),
            "max": round(float(row[1]), 2),
            "avg": round(float(row[2]), 2),
        }

    return schemas.TelemetryStats(
        count=count,
        temperature_c=stats_for(Telemetry.temperature_c),
        humidity_percent=stats_for(Telemetry.humidity_percent),
        current_a=stats_for(Telemetry.current_a),
        water_level=stats_for(Telemetry.water_level),
    )
