"""Environment-based settings. All values can be overridden via .env or real env vars."""

import os
from pathlib import Path

from dotenv import load_dotenv

BASE_DIR = Path(__file__).resolve().parent.parent
load_dotenv(BASE_DIR / ".env")

_LOCAL_CORS_ORIGINS = (
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "http://localhost:4173",
    "http://127.0.0.1:4173",
)


def _get(key: str, default: str = "") -> str:
    return os.environ.get(key, default)


def _get_bool(key: str, default: bool) -> bool:
    return _get(key, "true" if default else "false").strip().lower() in ("1", "true", "yes", "on")


def _get_int(key: str, default: int) -> int:
    try:
        return int(_get(key, str(default)))
    except ValueError:
        return default


def _normalize_database_url(url: str) -> str:
    """Render/Heroku hand out postgres://; SQLAlchemy + psycopg need postgresql+psycopg://."""
    if url.startswith("postgres://"):
        url = "postgresql://" + url[len("postgres://") :]
    if url.startswith("postgresql://") and "+psycopg" not in url.split("://", 1)[0]:
        url = "postgresql+psycopg://" + url[len("postgresql://") :]
    return url


def _cors_origins() -> list[str]:
    raw = _get("CORS_ORIGINS", "")
    extras = [o.strip().rstrip("/") for o in raw.split(",") if o.strip()]
    # Preserve order, drop duplicates
    seen: set[str] = set()
    origins: list[str] = []
    for origin in (*_LOCAL_CORS_ORIGINS, *extras):
        if origin not in seen:
            seen.add(origin)
            origins.append(origin)
    return origins


class Settings:
    DATABASE_URL: str = _normalize_database_url(
        _get("DATABASE_URL", f"sqlite:///{BASE_DIR / 'coldguard.db'}")
    )

    JWT_SECRET: str = _get(
        "JWT_SECRET", "coldguard-dev-secret-change-in-production-0123456789"
    )
    JWT_ALGORITHM: str = "HS256"
    JWT_EXPIRE_MINUTES: int = _get_int("JWT_EXPIRE_MINUTES", 480)

    # Comma-separated production frontends (e.g. https://coldguard.vercel.app)
    CORS_ORIGINS: list[str] = _cors_origins()

    MQTT_ENABLED: bool = _get_bool("MQTT_ENABLED", True)
    MQTT_HOST: str = _get("MQTT_HOST", "localhost")
    MQTT_PORT: int = _get_int("MQTT_PORT", 1883)
    MQTT_USERNAME: str = _get("MQTT_USERNAME")
    MQTT_PASSWORD: str = _get("MQTT_PASSWORD")

    RULE_CONSECUTIVE_BREACHES: int = _get_int("RULE_CONSECUTIVE_BREACHES", 2)
    RULE_BREACH_WINDOW_SECONDS: int = _get_int("RULE_BREACH_WINDOW_SECONDS", 600)
    DEVICE_OFFLINE_SECONDS: int = _get_int("DEVICE_OFFLINE_SECONDS", 300)

    # Email via Resend (https://resend.com/api-keys) — optional; incidents still logged
    RESEND_API_KEY: str = _get("RESEND_API_KEY")
    RESEND_FROM: str = _get("RESEND_FROM", "ColdGuard <onboarding@resend.dev>")
    NOTIFY_EMAILS: str = _get(
        "NOTIFY_EMAILS", "operator@coldguard.local,admin@coldguard.local"
    )

    # Vision agent (Claude) — optional; static produce profiles used without a key
    ANTHROPIC_API_KEY: str = _get("ANTHROPIC_API_KEY")
    ANTHROPIC_MODEL: str = _get("ANTHROPIC_MODEL", "claude-sonnet-4-5")
    VISION_MODEL: str = _get("VISION_MODEL", "yoloe-26s-seg.pt")


settings = Settings()
