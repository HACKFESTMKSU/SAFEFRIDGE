from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from .. import mappers, schemas
from ..auth import admin_only, get_current_user
from ..database import get_db
from ..models import Asset, Device, User

router = APIRouter(prefix="/devices", tags=["devices"])


def _get_device(db: Session, device_id: str) -> Device:
    device = db.get(Device, device_id)
    if device is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Device not found")
    return device


@router.get("", response_model=list[schemas.DeviceOut])
def list_devices(db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    return [
        mappers.device_out(d)
        for d in db.scalars(select(Device).order_by(Device.id)).all()
    ]


@router.post("", response_model=schemas.DeviceOut, status_code=status.HTTP_201_CREATED)
def create_device(
    body: schemas.DeviceCreate,
    db: Session = Depends(get_db),
    _: User = Depends(admin_only),
):
    if db.get(Device, body.id) is not None:
        raise HTTPException(status.HTTP_409_CONFLICT, "Device id already exists")
    if body.asset_id and db.get(Asset, body.asset_id) is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Asset not found")
    device = Device(
        id=body.id,
        name=body.name,
        firmware_version=body.firmware_version,
        asset_id=body.asset_id,
    )
    if body.asset_id:
        asset = db.get(Asset, body.asset_id)
        asset.device_id = body.id
    db.add(device)
    db.commit()
    db.refresh(device)
    return mappers.device_out(device)


@router.patch("/{device_id}", response_model=schemas.DeviceOut)
def update_device(
    device_id: str,
    body: schemas.DeviceUpdate,
    db: Session = Depends(get_db),
    _: User = Depends(admin_only),
):
    device = _get_device(db, device_id)
    data = body.model_dump(exclude_unset=True)
    new_asset_id = data.pop("asset_id", None)
    for field, value in data.items():
        setattr(device, field, value)
    if new_asset_id is not None or "asset_id" in body.model_fields_set:
        # unlink from old asset
        if device.asset_id and device.asset_id != new_asset_id:
            old = db.get(Asset, device.asset_id)
            if old and old.device_id == device.id:
                old.device_id = None
        device.asset_id = new_asset_id
        if new_asset_id:
            asset = db.get(Asset, new_asset_id)
            if asset is None:
                raise HTTPException(status.HTTP_404_NOT_FOUND, "Asset not found")
            if asset.device_id and asset.device_id != device.id:
                other = db.get(Device, asset.device_id)
                if other:
                    other.asset_id = None
            asset.device_id = device.id
    db.commit()
    db.refresh(device)
    return mappers.device_out(device)
