"""SQLAlchemy models matching SRS §7 and the frontend types in web/src/types.ts."""

import uuid
from datetime import datetime, timezone

from sqlalchemy import (
    Boolean,
    DateTime,
    Float,
    ForeignKey,
    Integer,
    String,
    Text,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.types import JSON

from .database import Base


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


def new_id(prefix: str) -> str:
    return f"{prefix}-{uuid.uuid4().hex[:8]}"


class User(Base):
    __tablename__ = "users"

    id: Mapped[str] = mapped_column(String(32), primary_key=True, default=lambda: new_id("u"))
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True)
    name: Mapped[str] = mapped_column(String(120), default="")
    phone: Mapped[str] = mapped_column(String(40), default="")
    role: Mapped[str] = mapped_column(String(20), default="technician")  # admin|operator|technician
    password_hash: Mapped[str] = mapped_column(String(255))


class Asset(Base):
    __tablename__ = "assets"

    id: Mapped[str] = mapped_column(String(32), primary_key=True, default=lambda: new_id("ast"))
    name: Mapped[str] = mapped_column(String(160))
    type: Mapped[str] = mapped_column(String(20), default="refrigerator")  # refrigerator|freezer|cold_box
    location: Mapped[str] = mapped_column(String(200), default="")
    status: Mapped[str] = mapped_column(String(20), default="active")  # active|inactive|maintenance

    # thresholds (FR-18)
    temp_min_c: Mapped[float] = mapped_column(Float, default=2.0)
    temp_max_c: Mapped[float] = mapped_column(Float, default=8.0)
    temp_warning_c: Mapped[float] = mapped_column(Float, default=7.0)
    temp_critical_c: Mapped[float] = mapped_column(Float, default=10.0)
    humidity_max_percent: Mapped[float | None] = mapped_column(Float, nullable=True)
    water_wet_threshold: Mapped[float | None] = mapped_column(Float, nullable=True)
    current_min_a: Mapped[float | None] = mapped_column(Float, nullable=True)

    sms_recipients: Mapped[list] = mapped_column(JSON, default=list)
    device_id: Mapped[str | None] = mapped_column(
        String(40), ForeignKey("devices.id", use_alter=True), nullable=True
    )

    # Independent many-to-one links (asset.device_id and device.asset_id are
    # kept in sync by the API layer; they are not ORM back-references).
    device: Mapped["Device | None"] = relationship(foreign_keys=[device_id])
    notes: Mapped[list["MaintenanceNote"]] = relationship(back_populates="asset")
    incidents: Mapped[list["Incident"]] = relationship(back_populates="asset")


class Device(Base):
    __tablename__ = "devices"

    id: Mapped[str] = mapped_column(String(40), primary_key=True)  # e.g. 'CG-001'
    name: Mapped[str] = mapped_column(String(160), default="")
    firmware_version: Mapped[str] = mapped_column(String(40), default="0.1.0")
    last_seen: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    online: Mapped[bool] = mapped_column(Boolean, default=False)
    asset_id: Mapped[str | None] = mapped_column(
        String(32), ForeignKey("assets.id"), nullable=True
    )

    asset: Mapped["Asset | None"] = relationship(foreign_keys=[asset_id])
    telemetry: Mapped[list["Telemetry"]] = relationship(back_populates="device")


class Telemetry(Base):
    __tablename__ = "telemetry"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    device_id: Mapped[str] = mapped_column(String(40), ForeignKey("devices.id"), index=True)
    timestamp: Mapped[datetime] = mapped_column(DateTime(timezone=True), index=True)

    temperature_c: Mapped[float | None] = mapped_column(Float, nullable=True)
    humidity_percent: Mapped[float | None] = mapped_column(Float, nullable=True)
    current_a: Mapped[float | None] = mapped_column(Float, nullable=True)
    water_level: Mapped[float | None] = mapped_column(Float, nullable=True)
    water_wet: Mapped[bool] = mapped_column(Boolean, default=False)

    # 'ok' | 'suspect' — implausible readings are stored but flagged (FR-13)
    quality: Mapped[str] = mapped_column(String(20), default="ok")

    device: Mapped["Device"] = relationship(back_populates="telemetry")


class Incident(Base):
    __tablename__ = "incidents"

    id: Mapped[str] = mapped_column(String(32), primary_key=True, default=lambda: new_id("inc"))
    asset_id: Mapped[str] = mapped_column(String(32), ForeignKey("assets.id"), index=True)
    type: Mapped[str] = mapped_column(String(30))  # temperature|humidity|water|current|device_offline
    severity: Mapped[str] = mapped_column(String(20), default="warning")  # warning|critical
    status: Mapped[str] = mapped_column(String(20), default="open", index=True)  # open|acknowledged|resolved

    title: Mapped[str] = mapped_column(String(200))
    message: Mapped[str] = mapped_column(Text, default="")
    recommended_action: Mapped[str] = mapped_column(Text, default="")

    detected_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    acknowledged_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    acknowledged_by: Mapped[str | None] = mapped_column(String(32), nullable=True)
    resolved_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    resolved_by: Mapped[str | None] = mapped_column(String(32), nullable=True)
    resolve_note: Mapped[str | None] = mapped_column(Text, nullable=True)

    value: Mapped[float | None] = mapped_column(Float, nullable=True)
    threshold: Mapped[float | None] = mapped_column(Float, nullable=True)

    asset: Mapped["Asset"] = relationship(back_populates="incidents")
    notes: Mapped[list["MaintenanceNote"]] = relationship(back_populates="incident")


class MaintenanceNote(Base):
    __tablename__ = "maintenance_notes"

    id: Mapped[str] = mapped_column(String(40), primary_key=True, default=lambda: new_id("note"))
    asset_id: Mapped[str] = mapped_column(String(32), ForeignKey("assets.id"), index=True)
    incident_id: Mapped[str | None] = mapped_column(
        String(32), ForeignKey("incidents.id"), nullable=True
    )
    author_id: Mapped[str] = mapped_column(String(32))
    author_name: Mapped[str] = mapped_column(String(120), default="")
    body: Mapped[str] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)

    asset: Mapped["Asset"] = relationship(back_populates="notes")
    incident: Mapped["Incident | None"] = relationship(back_populates="notes")
