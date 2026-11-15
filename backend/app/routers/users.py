from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from .. import mappers, schemas
from ..auth import admin_only, hash_password
from ..database import get_db
from ..models import User

router = APIRouter(prefix="/users", tags=["users"])


@router.get("", response_model=list[schemas.UserOut])
def list_users(db: Session = Depends(get_db), _: User = Depends(admin_only)):
    return [
        mappers.user_out(u)
        for u in db.scalars(select(User).order_by(User.id)).all()
    ]


@router.post("", response_model=schemas.UserOut, status_code=status.HTTP_201_CREATED)
def create_user(
    body: schemas.UserCreate,
    db: Session = Depends(get_db),
    _: User = Depends(admin_only),
):
    email = body.email.strip().lower()
    if db.scalar(select(User).where(User.email == email)):
        raise HTTPException(status.HTTP_409_CONFLICT, "Email already registered")
    user = User(
        email=email,
        name=body.name,
        phone=body.phone,
        role=body.role,
        password_hash=hash_password(body.password or "changeme"),
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return mappers.user_out(user)


@router.patch("/{user_id}", response_model=schemas.UserOut)
def update_user(
    user_id: str,
    body: schemas.UserUpdate,
    db: Session = Depends(get_db),
    _: User = Depends(admin_only),
):
    user = db.get(User, user_id)
    if user is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "User not found")
    data = body.model_dump(exclude_unset=True)
    if "password" in data:
        if data["password"]:
            user.password_hash = hash_password(data["password"])
        data.pop("password")
    for field, value in data.items():
        setattr(user, field, value)
    db.commit()
    db.refresh(user)
    return mappers.user_out(user)
