from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from ..db import get_db
from ..models import Telemetry, User
from ..schemas import TelemetryIngest, TelemetryOut
from ..security import get_current_user
from ..serializers import telemetry_out
from ..services.telemetry import ingest_telemetry

router = APIRouter(prefix="/telemetry", tags=["telemetry"])


@router.get("/{device_id}", response_model=list[TelemetryOut])
def get_series(
    device_id: str,
    hours: int = Query(24, ge=1, le=168),
    db: Session = Depends(get_db),
    _user: User = Depends(get_current_user),
) -> list[TelemetryOut]:
    since = datetime.now(timezone.utc) - timedelta(hours=hours)
    rows = (
        db.query(Telemetry)
        .filter(Telemetry.device_id == device_id, Telemetry.timestamp >= since)
        .order_by(Telemetry.timestamp.asc())
        .all()
    )
    return [telemetry_out(r) for r in rows]


@router.get("/{device_id}/latest", response_model=TelemetryOut | None)
def get_latest(
    device_id: str,
    db: Session = Depends(get_db),
    _user: User = Depends(get_current_user),
) -> TelemetryOut | None:
    row = (
        db.query(Telemetry)
        .filter(Telemetry.device_id == device_id)
        .order_by(Telemetry.timestamp.desc())
        .first()
    )
    return telemetry_out(row) if row else None


@router.post("/ingest", response_model=TelemetryOut)
def http_ingest(
    body: TelemetryIngest,
    db: Session = Depends(get_db),
    _user: User = Depends(get_current_user),
) -> TelemetryOut:
    """HTTP fallback / lab test path for DHT11 readings (also used before MQTT is live)."""
    if body.temperature_c is None and body.humidity_percent is None:
        raise HTTPException(status_code=400, detail="Provide temperature_c and/or humidity_percent")
    row = ingest_telemetry(db, body)
    if not row:
        raise HTTPException(status_code=409, detail="Duplicate reading")
    return telemetry_out(row)
