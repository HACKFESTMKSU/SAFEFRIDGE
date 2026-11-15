import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from ..db import get_db
from ..models import User
from ..schemas import UserCreate, UserOut
from ..security import get_current_user, hash_password, require_roles
from ..serializers import user_out

router = APIRouter(prefix="/users", tags=["users"])


@router.get("", response_model=list[UserOut])
def list_users(
    db: Session = Depends(get_db),
    _user: User = Depends(get_current_user),
) -> list[UserOut]:
    rows = db.query(User).order_by(User.name).all()
    return [user_out(u) for u in rows]


@router.post("", response_model=UserOut, status_code=status.HTTP_201_CREATED)
def create_user(
    body: UserCreate,
    db: Session = Depends(get_db),
    _user: User = Depends(require_roles("admin")),
) -> UserOut:
    email = body.email.lower()
    if db.query(User).filter(User.email == email).first():
        raise HTTPException(status_code=409, detail="Email already exists")
    user = User(
        id=f"u-{uuid.uuid4().hex[:10]}",
        email=email,
        name=body.name,
        phone=body.phone,
        role=body.role,
        password_hash=hash_password(body.password),
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user_out(user)
