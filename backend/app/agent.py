"""Claude agent: detections + live telemetry → produce profile + explanation.

Uses Anthropic Messages API when ANTHROPIC_API_KEY is set; otherwise a static
profile lookup with a template status string.
"""

from __future__ import annotations

import json
import logging
import re
from typing import Any

from .config import settings
from .produce import PROFILES, ProduceProfile, get_profile

logger = logging.getLogger("coldguard.agent")


def _telemetry_summary(telemetry: dict[str, Any] | None) -> str:
    if not telemetry:
        return "No recent sensor reading."
    parts = []
    t = telemetry.get("temperature_c")
    h = telemetry.get("humidity_percent")
    if t is not None:
        parts.append(f"temperature {t:.1f}°C")
    if h is not None:
        parts.append(f"humidity {h:.0f}%")
    w = telemetry.get("water_wet")
    if w:
        parts.append("water sensor wet")
    return ", ".join(parts) if parts else "Sensors online but empty reading."


def _status_for_profile(profile: ProduceProfile, telemetry: dict[str, Any] | None) -> str:
    if not telemetry or telemetry.get("temperature_c") is None:
        return (
            f"{profile.label} profile active ({profile.temp_min_c}–{profile.temp_max_c}°C). "
            f"Waiting for live sensor data. {profile.notes}"
        )
    t = float(telemetry["temperature_c"])
    h = telemetry.get("humidity_percent")
    in_temp = profile.temp_min_c <= t <= profile.temp_max_c
    hum_ok = True
    if h is not None and profile.humidity_max_percent is not None:
        hum_ok = float(h) <= profile.humidity_max_percent
    if in_temp and hum_ok:
        band = "within"
    elif t > profile.temp_critical_c or t < profile.temp_min_c:
        band = "outside (critical)"
    else:
        band = "near or outside"
    hum_bit = f", humidity {float(h):.0f}%" if h is not None else ""
    return (
        f"{profile.label} at {t:.1f}°C{hum_bit} — {band} safe band "
        f"{profile.temp_min_c}–{profile.temp_max_c}°C "
        f"(humidity max {profile.humidity_max_percent:.0f}%). {profile.notes}"
    )


def _parse_json_block(text: str) -> dict[str, Any] | None:
    text = text.strip()
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        pass
    match = re.search(r"\{[\s\S]*\}", text)
    if match:
        try:
            return json.loads(match.group(0))
        except json.JSONDecodeError:
            return None
    return None


def _call_claude(
    product_key: str | None,
    detections: list[dict],
    confidence: float,
    telemetry: dict[str, Any] | None,
    asset_name: str,
) -> dict[str, Any] | None:
    api_key = (settings.ANTHROPIC_API_KEY or "").strip()
    # Placeholder keys still look set and would block the boxed preview on a failed call.
    if not api_key or "YOUR_" in api_key:
        return None
    try:
        import anthropic
    except ImportError:
        logger.warning("anthropic package not installed")
        return None

    catalog = [
        {
            "product_key": p.product_key,
            "label": p.label,
            "temp_min_c": p.temp_min_c,
            "temp_max_c": p.temp_max_c,
            "humidity_max_percent": p.humidity_max_percent,
            "notes": p.notes,
        }
        for p in PROFILES.values()
    ]
    user_payload = {
        "asset": asset_name,
        "vision_top_product_key": product_key,
        "vision_confidence": confidence,
        "detections": detections[:10],
        "latest_telemetry": telemetry,
        "catalog": catalog,
    }
    system = (
        "You are ColdGuard, an agri cold-chain agent for farms, markets, food hubs, "
        "warehouses and produce cold rooms. Given vision detections and live sensor "
        "data, pick ONE product_key from the catalog (or null if unclear) and explain "
        "whether current conditions are safe for that produce. "
        "Never invent threshold numbers outside the catalog. "
        "Respond with ONLY JSON: "
        '{"product_key":"tomato"|"null", "confidence":0-1, "apply_thresholds":true|false, '
        '"status":"short operator sentence", "guidance":"one short action tip"}'
    )
    try:
        # Boxes are already drawn by the time we get here. Don't let a slow
        # or retrying call hold the annotated JPEG (SDK default timeout is 10 min).
        client = anthropic.Anthropic(api_key=api_key, timeout=8.0, max_retries=0)
        msg = client.messages.create(
            model=settings.ANTHROPIC_MODEL,
            max_tokens=400,
            system=system,
            messages=[
                {
                    "role": "user",
                    "content": json.dumps(user_payload),
                }
            ],
        )
        text = ""
        for block in msg.content:
            if hasattr(block, "text"):
                text += block.text
        parsed = _parse_json_block(text)
        if not parsed:
            logger.warning("Claude returned non-JSON: %s", text[:200])
            return None
        key = parsed.get("product_key")
        if key in ("null", None, ""):
            parsed["product_key"] = None
        elif key not in PROFILES:
            # Prefer vision top if Claude hallucinated a key
            parsed["product_key"] = product_key if product_key in PROFILES else None
        return parsed
    except Exception as exc:
        logger.warning("Claude agent call failed: %s", exc)
        return None


def decide_and_explain(
    *,
    product_key: str | None,
    detections: list[dict],
    confidence: float,
    telemetry: dict[str, Any] | None,
    asset_name: str,
) -> dict[str, Any]:
    """Return product_key, whether to apply thresholds, status, guidance, source."""
    claude = _call_claude(product_key, detections, confidence, telemetry, asset_name)
    if claude:
        key = claude.get("product_key") or product_key
        profile = get_profile(key) if key else None
        apply = bool(claude.get("apply_thresholds", True)) and profile is not None
        status = claude.get("status") or (
            _status_for_profile(profile, telemetry) if profile else "No produce profile selected."
        )
        guidance = claude.get("guidance") or (
            profile.notes if profile else "Upload a clearer clip or pick produce manually."
        )
        return {
            "product_key": key,
            "confidence": float(claude.get("confidence") or confidence or 0.0),
            "apply_thresholds": apply,
            "status": status,
            "guidance": guidance,
            "agent_source": "claude",
            "profile": profile,
        }

    # Static fallback
    key = product_key if product_key in PROFILES else None
    profile = get_profile(key) if key else None
    return {
        "product_key": key,
        "confidence": confidence,
        "apply_thresholds": profile is not None,
        "status": (
            _status_for_profile(profile, telemetry)
            if profile
            else "No produce detected — pick a crop manually to adapt thresholds."
        ),
        "guidance": (
            profile.notes
            if profile
            else "Use Characterize with a clear produce video, or select from the catalog."
        ),
        "agent_source": "static",
        "profile": profile,
    }


def apply_profile_to_asset(asset, profile: ProduceProfile) -> None:
    """Write catalog thresholds onto the asset (rules.py reads these columns)."""
    asset.temp_min_c = profile.temp_min_c
    asset.temp_max_c = profile.temp_max_c
    asset.temp_warning_c = profile.temp_warning_c
    asset.temp_critical_c = profile.temp_critical_c
    asset.humidity_max_percent = profile.humidity_max_percent
    asset.product_key = profile.product_key
