from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from .. import mappers, schemas
from ..auth import admin_or_operator, get_current_user
from ..database import get_db
from ..models import Incident, MaintenanceNote, User, utcnow

router = APIRouter(prefix="/incidents", tags=["incidents"])


def _get_incident(db: Session, incident_id: str) -> Incident:
    inc = db.get(Incident, incident_id)
    if inc is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Incident not found")
    return inc


@router.get("", response_model=list[schemas.IncidentOut])
def list_incidents(
    status_filter: str | None = Query(default=None, alias="status"),
    severity: str | None = None,
    asset: str | None = None,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    q = select(Incident).order_by(Incident.detected_at.desc())
    if status_filter:
        q = q.where(Incident.status == status_filter)
    if severity:
        q = q.where(Incident.severity == severity)
    if asset:
        q = q.where(Incident.asset_id == asset)
    return [mappers.incident_out(i) for i in db.scalars(q).all()]


@router.get("/{incident_id}", response_model=schemas.IncidentOut)
def get_incident(
    incident_id: str,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    return mappers.incident_out(_get_incident(db, incident_id))


@router.post("/{incident_id}/acknowledge", response_model=schemas.IncidentOut)
def acknowledge_incident(
    incident_id: str,
    user: User = Depends(admin_or_operator),
    db: Session = Depends(get_db),
):
    inc = _get_incident(db, incident_id)
    if inc.status == "open":
        inc.status = "acknowledged"
        inc.acknowledged_at = utcnow()
        inc.acknowledged_by = user.id
        db.commit()
        db.refresh(inc)
    return mappers.incident_out(inc)


@router.post("/{incident_id}/resolve", response_model=schemas.IncidentOut)
def resolve_incident(
    incident_id: str,
    body: schemas.ResolveRequest,
    user: User = Depends(admin_or_operator),
    db: Session = Depends(get_db),
):
    inc = _get_incident(db, incident_id)
    if inc.status != "resolved":
        now = utcnow()
        inc.status = "resolved"
        inc.resolved_at = now
        inc.resolved_by = user.id
        inc.resolve_note = body.note
        if inc.acknowledged_at is None:
            inc.acknowledged_at = now
            inc.acknowledged_by = user.id
        db.commit()
        db.refresh(inc)
    return mappers.incident_out(inc)


@router.post("/{incident_id}/notes", response_model=schemas.NoteOut, status_code=status.HTTP_201_CREATED)
def add_incident_note(
    incident_id: str,
    body: schemas.NoteCreate,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    inc = _get_incident(db, incident_id)
    note = MaintenanceNote(
        asset_id=inc.asset_id,
        incident_id=inc.id,
        author_id=user.id,
        author_name=user.name,
        body=body.body,
    )
    db.add(note)
    db.commit()
    db.refresh(note)
    return mappers.note_out(note)
