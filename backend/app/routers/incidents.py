from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from ..db import get_db
from ..models import Incident, User
from ..schemas import IncidentOut, ResolveRequest
from ..security import get_current_user, require_roles
from ..serializers import incident_out

router = APIRouter(prefix="/incidents", tags=["incidents"])


@router.get("", response_model=list[IncidentOut])
def list_incidents(
    db: Session = Depends(get_db),
    _user: User = Depends(get_current_user),
) -> list[IncidentOut]:
    rows = db.query(Incident).order_by(Incident.detected_at.desc()).all()
    return [incident_out(i) for i in rows]


@router.post("/{incident_id}/acknowledge", response_model=IncidentOut)
def acknowledge(
    incident_id: str,
    db: Session = Depends(get_db),
    user: User = Depends(require_roles("admin", "operator")),
) -> IncidentOut:
    incident = db.get(Incident, incident_id)
    if not incident:
        raise HTTPException(status_code=404, detail="Incident not found")
    if incident.status == "open":
        incident.status = "acknowledged"
        incident.acknowledged_at = datetime.now(timezone.utc)
        incident.acknowledged_by = user.id
        db.commit()
        db.refresh(incident)
    return incident_out(incident)


@router.post("/{incident_id}/resolve", response_model=IncidentOut)
def resolve(
    incident_id: str,
    body: ResolveRequest,
    db: Session = Depends(get_db),
    user: User = Depends(require_roles("admin", "operator")),
) -> IncidentOut:
    incident = db.get(Incident, incident_id)
    if not incident:
        raise HTTPException(status_code=404, detail="Incident not found")
    if incident.status != "resolved":
        now = datetime.now(timezone.utc)
        if incident.status == "open":
            incident.acknowledged_at = now
            incident.acknowledged_by = user.id
        incident.status = "resolved"
        incident.resolved_at = now
        incident.resolved_by = user.id
        incident.resolve_note = body.note
        db.commit()
        db.refresh(incident)
    return incident_out(incident)
