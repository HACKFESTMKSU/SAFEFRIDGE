"""Threshold rule engine (FR-18 / FR-19 / FR-21).

Evaluates each stored telemetry reading against the linked asset's
thresholds. A breach must persist for RULE_CONSECUTIVE_BREACHES consecutive
readings (within RULE_BREACH_WINDOW_SECONDS) before an Incident is created.
Duplicate incidents are suppressed while one of the same type is open or
acknowledged for that asset.
"""

import logging
from datetime import datetime, timedelta, timezone

from sqlalchemy import select
from sqlalchemy.orm import Session

from .config import settings
from .models import Asset, Device, Incident, Telemetry, utcnow
from . import notify

logger = logging.getLogger("coldguard.rules")

RECOMMENDED_ACTIONS = {
    "temperature": "Check door seal and compressor power. Move critical stock if recovery stalls.",
    "humidity": "Check door gaskets and defrost drain; verify the unit is sealing properly.",
    "water": "Inspect drip tray and floor for overflow; dry the probe area.",
    "current": "Check compressor power and wiring; near-zero current may mean the compressor is not running.",
    "device_offline": "Verify Wi-Fi near the unit. Check SIM800L SMS if a critical threshold may have fired offline.",
}

TITLES = {
    "temperature": "Temperature excursion",
    "humidity": "High humidity",
    "water": "Water sensor wet",
    "current": "Abnormal current draw",
    "device_offline": "Device offline",
}

# In-memory sustained-breach tracker: (device_id, rule_type) -> state dict
_breach_state: dict[tuple[str, str], dict] = {}


def _breeding_key(device_id: str, rule_type: str) -> tuple[str, str]:
    return (device_id, rule_type)


def _check_sustained(device_id: str, rule_type: str, breached: bool, now: datetime) -> bool:
    """Return True when `breached` has held for the configured consecutive count."""
    key = _breeding_key(device_id, rule_type)
    required = max(1, settings.RULE_CONSECUTIVE_BREACHES)
    window = timedelta(seconds=settings.RULE_BREACH_WINDOW_SECONDS)
    state = _breach_state.get(key)

    if not breached:
        _breach_state.pop(key, None)
        return False

    if state is None or now - state["last"] > window:
        state = {"count": 0, "last": now}
        _breach_state[key] = state
    state["count"] += 1
    state["last"] = now
    return state["count"] >= required


def _open_incident_exists(db: Session, asset_id: str, inc_type: str) -> bool:
    return (
        db.scalar(
            select(Incident.id).where(
                Incident.asset_id == asset_id,
                Incident.type == inc_type,
                Incident.status.in_(["open", "acknowledged"]),
            )
        )
        is not None
    )


def _create_incident(
    db: Session,
    asset: Asset,
    inc_type: str,
    severity: str,
    message: str,
    value: float | None,
    threshold: float | None,
) -> Incident:
    inc = Incident(
        asset_id=asset.id,
        type=inc_type,
        severity=severity,
        status="open",
        title=TITLES.get(inc_type, inc_type.replace("_", " ").title()),
        message=message,
        recommended_action=RECOMMENDED_ACTIONS.get(inc_type, "Investigate the unit."),
        detected_at=utcnow(),
        value=value,
        threshold=threshold,
    )
    db.add(inc)
    db.commit()
    db.refresh(inc)
    logger.info("Created %s incident %s for asset %s", severity, inc.id, asset.id)
    notify.notify_incident(db, inc)
    return inc


def _maybe_incident(
    db: Session,
    device: Device,
    asset: Asset,
    inc_type: str,
    breached: bool,
    severity: str,
    message: str,
    value: float | None,
    threshold: float | None,
    now: datetime,
) -> None:
    if not _check_sustained(device.id, inc_type, breached, now):
        return
    if _open_incident_exists(db, asset.id, inc_type):
        return
    _create_incident(db, asset, inc_type, severity, message, value, threshold)


def evaluate_telemetry(db: Session, device: Device, reading: Telemetry) -> None:
    """Run all threshold rules for one stored telemetry row."""
    if device.asset_id is None:
        return
    asset = db.get(Asset, device.asset_id)
    if asset is None:
        return
    if reading.quality != "ok":
        return  # implausible readings are stored but never trigger incidents (FR-13)

    now = reading.timestamp or utcnow()
    if now.tzinfo is None:
        now = now.replace(tzinfo=timezone.utc)

    t = reading.temperature_c
    if t is not None:
        # High-side excursion (coolers fail warm); low side is critical too.
        if t < asset.temp_min_c:
            _maybe_incident(
                db, device, asset, "temperature", True, "critical",
                f"{asset.name} reading {t:.1f}°C below minimum {asset.temp_min_c:.1f}°C.",
                t, asset.temp_min_c, now,
            )
        elif t >= asset.temp_critical_c:
            _maybe_incident(
                db, device, asset, "temperature", True, "critical",
                f"{asset.name} reading {t:.1f}°C (critical ≥ {asset.temp_critical_c:.1f}°C).",
                t, asset.temp_critical_c, now,
            )
        elif t > asset.temp_warning_c or t > asset.temp_max_c:
            bound = min(asset.temp_warning_c, asset.temp_max_c)
            _maybe_incident(
                db, device, asset, "temperature", True, "warning",
                f"{asset.name} reading {t:.1f}°C approaching limit {bound:.1f}°C.",
                t, bound, now,
            )
        else:
            _check_sustained(device.id, "temperature", False, now)

    h = reading.humidity_percent
    if h is not None and asset.humidity_max_percent is not None:
        breached = h > asset.humidity_max_percent
        severity = "critical" if h > asset.humidity_max_percent + 15 else "warning"
        _maybe_incident(
            db, device, asset, "humidity", breached, severity,
            f"{asset.name} humidity {h:.0f}% above limit {asset.humidity_max_percent:.0f}%.",
            h, asset.humidity_max_percent, now,
        )

    if asset.water_wet_threshold is not None:
        level = reading.water_level or 0.0
        breached = bool(reading.water_wet) or level >= asset.water_wet_threshold
        _maybe_incident(
            db, device, asset, "water", breached, "warning",
            f"Water/leak detected under {asset.name} (level {level:.0f}, threshold {asset.water_wet_threshold:.0f}).",
            level, asset.water_wet_threshold, now,
        )

    c = reading.current_a
    if c is not None and asset.current_min_a is not None:
        # Near-zero current while the unit should be running -> compressor fault heuristic.
        breached = 0 <= c < asset.current_min_a
        _maybe_incident(
            db, device, asset, "current", breached, "warning",
            f"{asset.name} current draw {c:.2f}A below expected minimum {asset.current_min_a:.2f}A — compressor may not be running.",
            c, asset.current_min_a, now,
        )


def check_offline_devices(db: Session) -> None:
    """Periodic check: linked devices silent longer than DEVICE_OFFLINE_SECONDS."""
    cutoff = datetime.now(timezone.utc) - timedelta(seconds=settings.DEVICE_OFFLINE_SECONDS)
    devices = db.scalars(select(Device).where(Device.asset_id.is_not(None))).all()
    for device in devices:
        last = device.last_seen
        if last is not None and last.tzinfo is None:
            last = last.replace(tzinfo=timezone.utc)
        silent = last is None or last < cutoff
        if silent and device.online:
            device.online = False
        elif not silent and not device.online:
            device.online = True

        asset = db.get(Asset, device.asset_id)
        if asset is None:
            continue
        now = utcnow()
        if silent:
            mins = settings.DEVICE_OFFLINE_SECONDS // 60
            _maybe_incident(
                db, device, asset, "device_offline", True, "warning",
                f"{device.id} has not reported for over {mins} minutes.",
                None, None, now,
            )
        else:
            _check_sustained(device.id, "device_offline", False, now)
            # Auto-resolve open offline incidents once the device is back.
            stale = db.scalars(
                select(Incident).where(
                    Incident.asset_id == asset.id,
                    Incident.type == "device_offline",
                    Incident.status.in_(["open", "acknowledged"]),
                )
            ).all()
            for inc in stale:
                inc.status = "resolved"
                inc.resolved_at = now
                inc.resolved_by = "system"
                inc.resolve_note = "Device back online."
    db.commit()


def clear_offline_incidents(db: Session, device: Device) -> None:
    """Called when telemetry arrives: resolve open device_offline incidents."""
    if device.asset_id is None:
        return
    stale = db.scalars(
        select(Incident).where(
            Incident.asset_id == device.asset_id,
            Incident.type == "device_offline",
            Incident.status.in_(["open", "acknowledged"]),
        )
    ).all()
    for inc in stale:
        inc.status = "resolved"
        inc.resolved_at = utcnow()
        inc.resolved_by = "system"
        inc.resolve_note = "Device reported telemetry again."
    db.commit()
