from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from ..db import get_db
from ..models import Asset, Device, User
from ..schemas import DeviceLinkRequest, DeviceOut
from ..security import get_current_user, require_roles
from ..serializers import device_out

router = APIRouter(prefix="/devices", tags=["devices"])


@router.get("", response_model=list[DeviceOut])
def list_devices(
    db: Session = Depends(get_db),
    _user: User = Depends(get_current_user),
) -> list[DeviceOut]:
    rows = db.query(Device).order_by(Device.id).all()
    return [device_out(d) for d in rows]


@router.patch("/{device_id}/link", response_model=DeviceOut)
def link_device(
    device_id: str,
    body: DeviceLinkRequest,
    db: Session = Depends(get_db),
    _user: User = Depends(require_roles("admin")),
) -> DeviceOut:
    device = db.get(Device, device_id)
    if not device:
        raise HTTPException(status_code=404, detail="Device not found")

    # Unlink any asset currently pointing at this device
    for asset in db.query(Asset).filter(Asset.device_id == device_id).all():
        asset.device_id = None

    if body.assetId:
        target = db.get(Asset, body.assetId)
        if not target:
            raise HTTPException(status_code=404, detail="Asset not found")
        # Unlink previous device on that asset
        if target.device_id and target.device_id != device_id:
            prev = db.get(Device, target.device_id)
            if prev:
                prev.asset_id = None
        target.device_id = device_id
        device.asset_id = body.assetId
    else:
        device.asset_id = None

    db.commit()
    db.refresh(device)
    return device_out(device)
