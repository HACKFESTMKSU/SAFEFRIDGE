from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from .. import schemas
from ..auth import get_current_user
from ..database import get_db
from ..models import Asset, Device, Incident, User

router = APIRouter(prefix="/dashboard", tags=["dashboard"])


@router.get("/summary", response_model=schemas.DashboardSummary)
def summary(db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    day_ago = datetime.now(timezone.utc) - timedelta(hours=24)

    total_assets = db.scalar(select(func.count()).select_from(Asset)) or 0
    active_assets = (
        db.scalar(select(func.count()).select_from(Asset).where(Asset.status == "active")) or 0
    )
    total_devices = db.scalar(select(func.count()).select_from(Device)) or 0
    online_devices = (
        db.scalar(select(func.count()).select_from(Device).where(Device.online.is_(True))) or 0
    )
    open_incidents = (
        db.scalar(
            select(func.count()).select_from(Incident).where(Incident.status == "open")
        )
        or 0
    )
    critical_incidents = (
        db.scalar(
            select(func.count()).select_from(Incident).where(
                Incident.severity == "critical",
                Incident.status.in_(["open", "acknowledged"]),
            )
        )
        or 0
    )
    acknowledged_incidents = (
        db.scalar(
            select(func.count()).select_from(Incident).where(Incident.status == "acknowledged")
        )
        or 0
    )
    resolved_24h = (
        db.scalar(
            select(func.count()).select_from(Incident).where(
                Incident.status == "resolved",
                Incident.resolved_at >= day_ago,
            )
        )
        or 0
    )
    return schemas.DashboardSummary(
        total_assets=total_assets,
        active_assets=active_assets,
        total_devices=total_devices,
        online_devices=online_devices,
        open_incidents=open_incidents,
        critical_incidents=critical_incidents,
        acknowledged_incidents=acknowledged_incidents,
        resolved_incidents_24h=resolved_24h,
    )
