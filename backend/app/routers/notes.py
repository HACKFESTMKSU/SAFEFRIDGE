import uuid

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from ..db import get_db
from ..models import Asset, MaintenanceNote, User
from ..schemas import NoteCreate, NoteOut
from ..security import get_current_user, require_roles
from ..serializers import note_out

router = APIRouter(prefix="/notes", tags=["notes"])


@router.get("", response_model=list[NoteOut])
def list_notes(
    asset_id: str | None = Query(None),
    db: Session = Depends(get_db),
    _user: User = Depends(get_current_user),
) -> list[NoteOut]:
    q = db.query(MaintenanceNote).order_by(MaintenanceNote.created_at.desc())
    if asset_id:
        q = q.filter(MaintenanceNote.asset_id == asset_id)
    return [note_out(n) for n in q.all()]


@router.post("", response_model=NoteOut, status_code=201)
def create_note(
    body: NoteCreate,
    db: Session = Depends(get_db),
    user: User = Depends(require_roles("admin", "technician")),
) -> NoteOut:
    if not db.get(Asset, body.assetId):
        raise HTTPException(status_code=404, detail="Asset not found")
    note = MaintenanceNote(
        id=f"note-{uuid.uuid4().hex[:10]}",
        asset_id=body.assetId,
        incident_id=body.incidentId,
        author_id=user.id,
        author_name=user.name,
        body=body.body,
    )
    db.add(note)
    db.commit()
    db.refresh(note)
    return note_out(note)
