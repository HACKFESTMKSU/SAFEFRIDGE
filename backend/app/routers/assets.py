from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from .. import mappers, schemas
from ..auth import admin_only, get_current_user
from ..database import get_db
from ..models import Asset, Device, MaintenanceNote, User

router = APIRouter(prefix="/assets", tags=["assets"])


def _get_asset(db: Session, asset_id: str) -> Asset:
    asset = db.get(Asset, asset_id)
    if asset is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Asset not found")
    return asset


@router.get("", response_model=list[schemas.AssetOut])
def list_assets(db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    return [mappers.asset_out(a) for a in db.scalars(select(Asset).order_by(Asset.id)).all()]


@router.post("", response_model=schemas.AssetOut, status_code=status.HTTP_201_CREATED)
def create_asset(
    body: schemas.AssetCreate,
    db: Session = Depends(get_db),
    _: User = Depends(admin_only),
):
    data = body.model_dump(by_alias=False, exclude={"thresholds", "sms_recipients"})
    th = body.thresholds
    asset = Asset(
        **data,
        sms_recipients=body.sms_recipients,
        temp_min_c=th.temp_min_c if th else 2.0,
        temp_max_c=th.temp_max_c if th else 8.0,
        temp_warning_c=th.temp_warning_c if th else 7.0,
        temp_critical_c=th.temp_critical_c if th else 10.0,
        humidity_max_percent=th.humidity_max_percent if th else None,
        water_wet_threshold=th.water_wet_threshold if th else None,
        current_min_a=th.current_min_a if th else None,
    )
    db.add(asset)
    db.commit()
    db.refresh(asset)
    return mappers.asset_out(asset)


@router.patch("/{asset_id}", response_model=schemas.AssetOut)
def update_asset(
    asset_id: str,
    body: schemas.AssetUpdate,
    db: Session = Depends(get_db),
    _: User = Depends(admin_only),
):
    asset = _get_asset(db, asset_id)
    for field, value in body.model_dump(exclude_unset=True).items():
        setattr(asset, field, value)
    db.commit()
    db.refresh(asset)
    return mappers.asset_out(asset)


@router.post("/{asset_id}/link-device", response_model=schemas.AssetOut)
def link_device(
    asset_id: str,
    body: schemas.LinkDeviceRequest,
    db: Session = Depends(get_db),
    _: User = Depends(admin_only),
):
    asset = _get_asset(db, asset_id)
    device = db.get(Device, body.device_id)
    if device is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Device not found")
    # unlink device from any previous asset, and clear this asset's old device
    if asset.device_id and asset.device_id != device.id:
        old = db.get(Device, asset.device_id)
        if old:
            old.asset_id = None
    for other in db.scalars(select(Asset).where(Asset.device_id == device.id)).all():
        if other.id != asset.id:
            other.device_id = None
    device.asset_id = asset.id
    asset.device_id = device.id
    db.commit()
    db.refresh(asset)
    return mappers.asset_out(asset)


@router.delete("/{asset_id}/link-device", response_model=schemas.AssetOut)
def unlink_device(
    asset_id: str,
    db: Session = Depends(get_db),
    _: User = Depends(admin_only),
):
    asset = _get_asset(db, asset_id)
    if asset.device_id:
        device = db.get(Device, asset.device_id)
        if device:
            device.asset_id = None
        asset.device_id = None
    db.commit()
    db.refresh(asset)
    return mappers.asset_out(asset)


@router.patch("/{asset_id}/thresholds", response_model=schemas.AssetOut)
def update_thresholds(
    asset_id: str,
    body: schemas.ThresholdsUpdate,
    db: Session = Depends(get_db),
    _: User = Depends(admin_only),
):
    asset = _get_asset(db, asset_id)
    data = body.model_dump(exclude_unset=True, by_alias=False)
    sms = data.pop("sms_recipients", None)
    for field, value in data.items():
        setattr(asset, field, value)
    if sms is not None:
        asset.sms_recipients = sms
    db.commit()
    db.refresh(asset)
    return mappers.asset_out(asset)


# ---------- Maintenance notes (FR-24: all roles may add) ----------

@router.get("/{asset_id}/notes", response_model=list[schemas.NoteOut])
def list_asset_notes(
    asset_id: str,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    _get_asset(db, asset_id)
    notes = db.scalars(
        select(MaintenanceNote)
        .where(MaintenanceNote.asset_id == asset_id)
        .order_by(MaintenanceNote.created_at.desc())
    ).all()
    return [mappers.note_out(n) for n in notes]


@router.post("/{asset_id}/notes", response_model=schemas.NoteOut, status_code=status.HTTP_201_CREATED)
def add_asset_note(
    asset_id: str,
    body: schemas.NoteCreate,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    _get_asset(db, asset_id)
    note = MaintenanceNote(
        asset_id=asset_id,
        incident_id=body.incident_id,
        author_id=user.id,
        author_name=user.name,
        body=body.body,
    )
    db.add(note)
    db.commit()
    db.refresh(note)
    return mappers.note_out(note)
