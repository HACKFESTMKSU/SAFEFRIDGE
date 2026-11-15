"""Environment-based settings. All values can be overridden via .env or real env vars."""

import os
from pathlib import Path

from dotenv import load_dotenv

BASE_DIR = Path(__file__).resolve().parent.parent
load_dotenv(BASE_DIR / ".env")


def _get(key: str, default: str = "") -> str:
    return os.environ.get(key, default)


def _get_bool(key: str, default: bool) -> bool:
    return _get(key, "true" if default else "false").strip().lower() in ("1", "true", "yes", "on")


def _get_int(key: str, default: int) -> int:
    try:
        return int(_get(key, str(default)))
    except ValueError:
        return default


class Settings:
    DATABASE_URL: str = _get(
        "DATABASE_URL", f"sqlite:///{BASE_DIR / 'coldguard.db'}"
    )

    JWT_SECRET: str = _get(
        "JWT_SECRET", "coldguard-dev-secret-change-in-production-0123456789"
    )
    JWT_ALGORITHM: str = "HS256"
    JWT_EXPIRE_MINUTES: int = _get_int("JWT_EXPIRE_MINUTES", 480)

    MQTT_ENABLED: bool = _get_bool("MQTT_ENABLED", True)
    MQTT_HOST: str = _get("MQTT_HOST", "localhost")
    MQTT_PORT: int = _get_int("MQTT_PORT", 1883)
    MQTT_USERNAME: str = _get("MQTT_USERNAME")
    MQTT_PASSWORD: str = _get("MQTT_PASSWORD")

    RULE_CONSECUTIVE_BREACHES: int = _get_int("RULE_CONSECUTIVE_BREACHES", 2)
    RULE_BREACH_WINDOW_SECONDS: int = _get_int("RULE_BREACH_WINDOW_SECONDS", 600)
    DEVICE_OFFLINE_SECONDS: int = _get_int("DEVICE_OFFLINE_SECONDS", 300)

    SMTP_HOST: str = _get("SMTP_HOST")
    SMTP_PORT: int = _get_int("SMTP_PORT", 587)
    SMTP_USERNAME: str = _get("SMTP_USERNAME")
    SMTP_PASSWORD: str = _get("SMTP_PASSWORD")
    SMTP_FROM: str = _get("SMTP_FROM", "coldguard@localhost")
    SMTP_USE_TLS: bool = _get_bool("SMTP_USE_TLS", True)
    NOTIFY_EMAILS: str = _get(
        "NOTIFY_EMAILS", "operator@coldguard.local,admin@coldguard.local"
    )


settings = Settings()
