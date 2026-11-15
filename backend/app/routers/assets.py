from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from ..db import get_db
from ..models import Asset, User
from ..schemas import AssetCreate, AssetOut, AssetThresholdsUpdate, Thresholds
from ..security import get_current_user, require_roles
from ..serializers import asset_out

router = APIRouter(prefix="/assets", tags=["assets"])


@router.get("", response_model=list[AssetOut])
def list_assets(
    db: Session = Depends(get_db),
    _user: User = Depends(get_current_user),
) -> list[AssetOut]:
    rows = db.query(Asset).order_by(Asset.name).all()
    return [asset_out(a) for a in rows]


@router.post("", response_model=AssetOut, status_code=status.HTTP_201_CREATED)
def create_asset(
    body: AssetCreate,
    db: Session = Depends(get_db),
    _user: User = Depends(require_roles("admin")),
) -> AssetOut:
    thresholds = (body.thresholds or Thresholds()).model_dump()
    asset = Asset(
        id=f"ast-{uuid.uuid4().hex[:10]}",
        name=body.name,
        type=body.type,
        location=body.location,
        status=body.status,
        device_id=None,
        sms_recipients=body.smsRecipients,
        thresholds=thresholds,
    )
    db.add(asset)
    db.commit()
    db.refresh(asset)
    return asset_out(asset)


@router.patch("/{asset_id}/thresholds", response_model=AssetOut)
def update_thresholds(
    asset_id: str,
    body: AssetThresholdsUpdate,
    db: Session = Depends(get_db),
    _user: User = Depends(require_roles("admin")),
) -> AssetOut:
    asset = db.get(Asset, asset_id)
    if not asset:
        raise HTTPException(status_code=404, detail="Asset not found")
    asset.thresholds = body.thresholds.model_dump()
    asset.sms_recipients = body.smsRecipients
    db.commit()
    db.refresh(asset)
    return asset_out(asset)
