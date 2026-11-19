import asyncio
import logging

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from .. import agent, mappers, schemas, vision
from ..auth import admin_only, get_current_user
from ..database import get_db
from ..models import Asset, Device, MaintenanceNote, Telemetry, User, utcnow
from ..produce import all_profiles, get_profile

logger = logging.getLogger("coldguard.assets")

router = APIRouter(prefix="/assets", tags=["assets"])


def _get_asset(db: Session, asset_id: str) -> Asset:
    asset = db.get(Asset, asset_id)
    if asset is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Asset not found")
    return asset


# Static paths first (before /{asset_id}/...)
@router.get("/produce/profiles", response_model=list[schemas.ProduceProfileOut])
def list_produce_profiles(_: User = Depends(get_current_user)):
    """Agri produce storage profiles used by the vision agent."""
    out = []
    for row in all_profiles():
        out.append(
            schemas.ProduceProfileOut(
                product_key=row["product_key"],
                label=row["label"],
                temp_min_c=row["temp_min_c"],
                temp_max_c=row["temp_max_c"],
                temp_warning_c=row["temp_warning_c"],
                temp_critical_c=row["temp_critical_c"],
                humidity_max_percent=row["humidity_max_percent"],
                notes=row["notes"],
                vision_prompts=list(row["vision_prompts"]),
            )
        )
    return out


@router.get("/vision/status")
def get_vision_status(_: User = Depends(get_current_user)):
    return vision.vision_status()


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


# ---------- Produce characterization (vision + agent) ----------

def _latest_telemetry_dict(db: Session, asset: Asset) -> dict | None:
    if not asset.device_id:
        return None
    row = db.scalar(
        select(Telemetry)
        .where(Telemetry.device_id == asset.device_id)
        .order_by(Telemetry.timestamp.desc())
        .limit(1)
    )
    if row is None:
        return None
    return {
        "temperature_c": row.temperature_c,
        "humidity_percent": row.humidity_percent,
        "current_a": row.current_a,
        "water_level": row.water_level,
        "water_wet": row.water_wet,
        "timestamp": row.timestamp.isoformat() if row.timestamp else None,
    }


@router.post("/{asset_id}/characterize", response_model=schemas.CharacterizeOut)
async def characterize_stock(
    asset_id: str,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Upload a short storehouse/cold-room video; YOLOE + Claude adapt produce thresholds.

    Demo path: video upload. Production path will feed ESP32-CAM frames into the
    same characterization + agent loop.
    """
    if user.role not in ("admin", "operator"):
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Admin or Operator required")

    asset = _get_asset(db, asset_id)
    content_type = (file.content_type or "").lower()
    name = file.filename or "clip.mp4"
    video_ok = content_type.startswith("video/") or name.lower().endswith(
        (".mp4", ".webm", ".mov", ".avi", ".mkv")
    )
    image_ok = content_type.startswith("image/") or name.lower().endswith(
        (".jpg", ".jpeg", ".png", ".webp", ".bmp")
    )
    if not (video_ok or image_ok):
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST,
            "Upload a short video (mp4/webm/mov) or image (jpg/png). "
            "Demo uses upload; production uses facility camera.",
        )

    data = await file.read()
    if not data:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Empty upload")

    try:
        result = await asyncio.to_thread(vision.characterize_video, data, name)
    except ValueError as exc:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, str(exc)) from exc
    except Exception as exc:
        logger.exception("Characterize failed")
        raise HTTPException(status.HTTP_500_INTERNAL_SERVER_ERROR, f"Vision failed: {exc}") from exc

    telemetry = _latest_telemetry_dict(db, asset)
    decision = agent.decide_and_explain(
        product_key=result.get("top_product_key"),
        detections=result.get("detections") or [],
        confidence=float(result.get("confidence") or 0.0),
        telemetry=telemetry,
        asset_name=asset.name,
    )

    applied = False
    profile = decision.get("profile")
    if decision.get("apply_thresholds") and profile is not None:
        agent.apply_profile_to_asset(asset, profile)
        asset.detection_confidence = float(decision.get("confidence") or 0.0)
        asset.last_detection_at = utcnow()
        asset.detection_source = "video_upload"
        asset.agent_notes = f"{decision.get('status', '')} | {decision.get('guidance', '')}".strip(" |")
        applied = True
        db.add(
            MaintenanceNote(
                asset_id=asset.id,
                author_id=user.id,
                author_name=user.name or user.email,
                body=(
                    f"Vision agent applied {profile.label} thresholds "
                    f"({profile.temp_min_c}–{profile.temp_max_c}°C) via {decision.get('agent_source')}."
                ),
            )
        )
        db.commit()
        db.refresh(asset)
    else:
        asset.agent_notes = decision.get("status")
        asset.last_detection_at = utcnow()
        asset.detection_source = "video_upload"
        asset.detection_confidence = float(decision.get("confidence") or 0.0)
        if decision.get("product_key"):
            asset.product_key = decision["product_key"]
        db.commit()
        db.refresh(asset)

    status_text = str(decision.get("status") or "")
    vision_msg = str(result.get("message") or "")
    if not result.get("vision_ready") and vision_msg:
        status_text = vision_msg

    return schemas.CharacterizeOut(
        asset=mappers.asset_out(asset),
        product_key=decision.get("product_key"),
        confidence=float(decision.get("confidence") or 0.0),
        detections=result.get("detections") or [],
        boxes=result.get("boxes") or [],
        preview_image_base64=result.get("preview_image_base64"),
        frames_sampled=int(result.get("frames_sampled") or 0),
        vision_model=result.get("model"),
        vision_ready=bool(result.get("vision_ready")),
        agent_source=str(decision.get("agent_source") or "static"),
        status=status_text,
        guidance=str(decision.get("guidance") or ""),
        thresholds_applied=applied,
        message=vision_msg,
    )


@router.post("/{asset_id}/produce", response_model=schemas.AssetOut)
def apply_produce_manual(
    asset_id: str,
    body: schemas.ApplyProduceRequest,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Manually set produce profile when vision is unavailable or wrong."""
    if user.role not in ("admin", "operator"):
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Admin or Operator required")
    asset = _get_asset(db, asset_id)
    profile = get_profile(body.product_key)
    if profile is None:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, f"Unknown product_key: {body.product_key}")
    agent.apply_profile_to_asset(asset, profile)
    asset.detection_confidence = 1.0
    asset.last_detection_at = utcnow()
    asset.detection_source = "manual"
    asset.agent_notes = (
        f"{profile.label} profile applied manually. "
        f"Safe band {profile.temp_min_c}–{profile.temp_max_c}°C. {profile.notes}"
    )
    db.add(
        MaintenanceNote(
            asset_id=asset.id,
            author_id=user.id,
            author_name=user.name or user.email,
            body=f"Manual produce profile: {profile.label} ({profile.temp_min_c}–{profile.temp_max_c}°C).",
        )
    )
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
