"""Pydantic v2 schemas. JSON field names match web/src/types.ts exactly."""

from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field
from pydantic.alias_generators import to_camel

Role = Literal["admin", "operator", "technician"]
AssetType = Literal["refrigerator", "freezer", "cold_box"]
AssetStatus = Literal["active", "inactive", "maintenance"]
IncidentType = Literal["temperature", "humidity", "water", "current", "device_offline"]
IncidentSeverity = Literal["warning", "critical"]
IncidentStatus = Literal["open", "acknowledged", "resolved"]

CamelModel = ConfigDict(populate_by_name=True, alias_generator=to_camel)


# ---------- Users ----------

class UserOut(BaseModel):
    model_config = CamelModel

    id: str
    email: str
    name: str = ""
    phone: str = ""
    role: Role
    password: str = ""  # never the hash; frontend type requires the field


class UserCreate(BaseModel):
    model_config = CamelModel

    email: str
    name: str = ""
    phone: str = ""
    role: Role = "technician"
    password: str = ""


class UserUpdate(BaseModel):
    model_config = CamelModel

    name: str | None = None
    phone: str | None = None
    role: Role | None = None
    password: str | None = None


# ---------- Assets / thresholds ----------

class Thresholds(BaseModel):
    model_config = CamelModel

    temp_min_c: float = Field(alias="tempMinC")
    temp_max_c: float = Field(alias="tempMaxC")
    temp_warning_c: float = Field(alias="tempWarningC")
    temp_critical_c: float = Field(alias="tempCriticalC")
    humidity_max_percent: float | None = Field(default=None, alias="humidityMaxPercent")
    water_wet_threshold: float | None = Field(default=None, alias="waterWetThreshold")
    current_min_a: float | None = Field(default=None, alias="currentMinA")


class ThresholdsUpdate(BaseModel):
    model_config = CamelModel

    temp_min_c: float | None = Field(default=None, alias="tempMinC")
    temp_max_c: float | None = Field(default=None, alias="tempMaxC")
    temp_warning_c: float | None = Field(default=None, alias="tempWarningC")
    temp_critical_c: float | None = Field(default=None, alias="tempCriticalC")
    humidity_max_percent: float | None = Field(default=None, alias="humidityMaxPercent")
    water_wet_threshold: float | None = Field(default=None, alias="waterWetThreshold")
    current_min_a: float | None = Field(default=None, alias="currentMinA")
    sms_recipients: list[str] | None = Field(default=None, alias="smsRecipients")


class AssetOut(BaseModel):
    model_config = CamelModel

    id: str
    name: str
    type: AssetType
    location: str = ""
    status: AssetStatus = "active"
    thresholds: Thresholds
    device_id: str | None = Field(default=None, alias="deviceId")
    sms_recipients: list[str] = Field(default_factory=list, alias="smsRecipients")


class AssetCreate(BaseModel):
    model_config = CamelModel

    name: str
    type: AssetType = "refrigerator"
    location: str = ""
    status: AssetStatus = "active"
    thresholds: Thresholds | None = None
    sms_recipients: list[str] = Field(default_factory=list, alias="smsRecipients")


class AssetUpdate(BaseModel):
    model_config = CamelModel

    name: str | None = None
    type: AssetType | None = None
    location: str | None = None
    status: AssetStatus | None = None


class LinkDeviceRequest(BaseModel):
    model_config = CamelModel

    device_id: str = Field(alias="deviceId")


# ---------- Devices ----------

class DeviceOut(BaseModel):
    model_config = CamelModel

    id: str
    name: str = ""
    firmware_version: str = Field(default="0.1.0", alias="firmwareVersion")
    online: bool = False
    last_seen: datetime | None = Field(default=None, alias="lastSeen")
    asset_id: str | None = Field(default=None, alias="assetId")


class DeviceCreate(BaseModel):
    model_config = CamelModel

    id: str = Field(min_length=1, max_length=40)
    name: str = ""
    firmware_version: str = Field(default="0.1.0", alias="firmwareVersion")
    asset_id: str | None = Field(default=None, alias="assetId")


class DeviceUpdate(BaseModel):
    model_config = CamelModel

    name: str | None = None
    firmware_version: str | None = Field(default=None, alias="firmwareVersion")
    online: bool | None = None
    asset_id: str | None = Field(default=None, alias="assetId")


# ---------- Telemetry (snake_case fields, per frontend TelemetryReading) ----------

class TelemetryReading(BaseModel):
    timestamp: datetime
    temperature_c: float | None = None
    humidity_percent: float | None = None
    bmp_temperature_c: float | None = None
    pressure_hpa: float | None = None
    current_a: float | None = None
    water_level: float | None = None
    water_wet: bool = False
    mq3_raw: float | None = None
    quality: str = "ok"


class TelemetryStats(BaseModel):
    count: int
    temperature_c: dict[str, float | None]
    humidity_percent: dict[str, float | None]
    current_a: dict[str, float | None]
    water_level: dict[str, float | None]


# ---------- Incidents ----------

class IncidentOut(BaseModel):
    model_config = CamelModel

    id: str
    asset_id: str = Field(alias="assetId")
    type: IncidentType
    severity: IncidentSeverity
    status: IncidentStatus
    title: str
    message: str = ""
    recommended_action: str = Field(default="", alias="recommendedAction")
    detected_at: datetime = Field(alias="detectedAt")
    acknowledged_at: datetime | None = Field(default=None, alias="acknowledgedAt")
    acknowledged_by: str | None = Field(default=None, alias="acknowledgedBy")
    resolved_at: datetime | None = Field(default=None, alias="resolvedAt")
    resolved_by: str | None = Field(default=None, alias="resolvedBy")
    resolve_note: str | None = Field(default=None, alias="resolveNote")
    value: float | None = None
    threshold: float | None = None


class ResolveRequest(BaseModel):
    note: str = ""


# ---------- Notes ----------

class NoteOut(BaseModel):
    model_config = CamelModel

    id: str
    asset_id: str = Field(alias="assetId")
    incident_id: str | None = Field(default=None, alias="incidentId")
    author_id: str = Field(alias="authorId")
    author_name: str = Field(default="", alias="authorName")
    body: str
    created_at: datetime = Field(alias="createdAt")


class NoteCreate(BaseModel):
    model_config = CamelModel

    body: str
    incident_id: str | None = Field(default=None, alias="incidentId")


# ---------- Auth ----------

class LoginRequest(BaseModel):
    email: str
    password: str


class TokenResponse(BaseModel):
    model_config = CamelModel

    token: str
    token_type: str = "bearer"
    user: UserOut


class ChangePasswordRequest(BaseModel):
    model_config = CamelModel

    current_password: str = Field(alias="currentPassword")
    new_password: str = Field(alias="newPassword", min_length=4)


class ProfileUpdate(BaseModel):
    model_config = CamelModel

    name: str | None = None
    phone: str | None = None
    password: str | None = None


# ---------- Dashboard ----------

class DashboardSummary(BaseModel):
    model_config = CamelModel

    total_assets: int
    active_assets: int
    total_devices: int
    online_devices: int
    open_incidents: int
    critical_incidents: int
    acknowledged_incidents: int
    resolved_incidents_24h: int
