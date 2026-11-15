from __future__ import annotations

from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, EmailStr, Field

Role = Literal["admin", "operator", "technician"]
AssetType = Literal["refrigerator", "freezer", "cold_box"]
AssetStatus = Literal["active", "inactive", "maintenance"]
IncidentType = Literal["temperature", "humidity", "water", "current", "device_offline"]
IncidentSeverity = Literal["warning", "critical"]
IncidentStatus = Literal["open", "acknowledged", "resolved"]


class Thresholds(BaseModel):
    tempMinC: float = 2
    tempMaxC: float = 8
    tempWarningC: float = 7
    tempCriticalC: float = 10
    humidityMaxPercent: float | None = 70
    waterWetThreshold: float | None = 500
    currentMinA: float | None = 0.3


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserOut


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class UserOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    email: EmailStr
    name: str
    phone: str
    role: Role


class UserCreate(BaseModel):
    email: EmailStr
    name: str
    phone: str = ""
    role: Role = "operator"
    password: str = Field(min_length=4)


class ProfileUpdate(BaseModel):
    name: str | None = None
    phone: str | None = None
    password: str | None = None


class AssetOut(BaseModel):
    id: str
    name: str
    type: AssetType
    location: str
    status: AssetStatus
    deviceId: str | None
    smsRecipients: list[str]
    thresholds: Thresholds


class AssetCreate(BaseModel):
    name: str
    type: AssetType = "refrigerator"
    location: str
    status: AssetStatus = "active"
    thresholds: Thresholds | None = None
    smsRecipients: list[str] = Field(default_factory=list)


class AssetThresholdsUpdate(BaseModel):
    thresholds: Thresholds
    smsRecipients: list[str] = Field(default_factory=list)


class DeviceOut(BaseModel):
    id: str
    name: str
    firmwareVersion: str
    online: bool
    lastSeen: str | None
    assetId: str | None


class DeviceLinkRequest(BaseModel):
    assetId: str | None = None


class TelemetryOut(BaseModel):
    timestamp: str
    temperature_c: float | None = None
    humidity_percent: float | None = None
    bmp_temperature_c: float | None = None
    pressure_hpa: float | None = None
    current_a: float | None = None
    water_level: float | None = None
    water_wet: bool | None = None
    mq3_raw: float | None = None


class TelemetryIngest(BaseModel):
    device_id: str
    timestamp: datetime | None = None
    temperature_c: float | None = None
    humidity_percent: float | None = None
    bmp_temperature_c: float | None = None
    pressure_hpa: float | None = None
    current_a: float | None = None
    water_level: float | None = None
    water_wet: bool | None = None
    mq3_raw: float | None = None
    firmware_version: str | None = None


class IncidentOut(BaseModel):
    id: str
    assetId: str
    type: IncidentType
    severity: IncidentSeverity
    status: IncidentStatus
    title: str
    message: str
    recommendedAction: str
    detectedAt: str
    acknowledgedAt: str | None = None
    acknowledgedBy: str | None = None
    resolvedAt: str | None = None
    resolvedBy: str | None = None
    resolveNote: str | None = None
    value: float | None = None
    threshold: float | None = None


class ResolveRequest(BaseModel):
    note: str = Field(min_length=1)


class NoteOut(BaseModel):
    id: str
    assetId: str
    incidentId: str | None = None
    authorId: str
    authorName: str
    body: str
    createdAt: str


class NoteCreate(BaseModel):
    assetId: str
    body: str = Field(min_length=1)
    incidentId: str | None = None
