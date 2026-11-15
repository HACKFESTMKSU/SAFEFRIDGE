"""Email notification hook (FR-19 / FR-22).

Sends email via SMTP when SMTP_HOST is configured; otherwise logs the
notification so the demo still shows incidents in-app.
"""

import logging
import smtplib
from email.message import EmailMessage

from sqlalchemy import select
from sqlalchemy.orm import Session

from .config import settings
from .models import Asset, Incident, User

logger = logging.getLogger("coldguard.notify")


def _recipients(db: Session, asset: Asset) -> list[str]:
    emails = [e.strip() for e in settings.NOTIFY_EMAILS.split(",") if e.strip()]
    # Also notify operator/admin users that have an email on file.
    users = db.scalars(select(User).where(User.role.in_(["operator", "admin"]))).all()
    emails += [u.email for u in users if u.email]
    return sorted(set(emails))


def notify_incident(db: Session, incident: Incident) -> None:
    """Called when a new incident is created. Email on critical, log otherwise."""
    asset = db.get(Asset, incident.asset_id)
    asset_name = asset.name if asset else incident.asset_id
    subject = f"[ColdGuard] {incident.severity.upper()}: {incident.title} — {asset_name}"
    body = (
        f"Asset: {asset_name}\n"
        f"Type: {incident.type}\n"
        f"Severity: {incident.severity}\n"
        f"Detected: {incident.detected_at.isoformat()}\n\n"
        f"{incident.message}\n\n"
        f"Recommended action: {incident.recommended_action}\n"
    )
    to = _recipients(db, asset) if asset else []

    if not settings.SMTP_HOST or not to:
        logger.info("SMTP not configured — incident %s logged only.\n%s", incident.id, body)
        return

    msg = EmailMessage()
    msg["Subject"] = subject
    msg["From"] = settings.SMTP_FROM
    msg["To"] = ", ".join(to)
    msg.set_content(body)

    try:
        if settings.SMTP_USE_TLS:
            with smtplib.SMTP(settings.SMTP_HOST, settings.SMTP_PORT, timeout=10) as s:
                s.starttls()
                if settings.SMTP_USERNAME:
                    s.login(settings.SMTP_USERNAME, settings.SMTP_PASSWORD)
                s.send_message(msg)
        else:
            with smtplib.SMTP(settings.SMTP_HOST, settings.SMTP_PORT, timeout=10) as s:
                if settings.SMTP_USERNAME:
                    s.login(settings.SMTP_USERNAME, settings.SMTP_PASSWORD)
                s.send_message(msg)
        logger.info("Incident notification emailed to %s", to)
    except Exception as exc:  # never let notify break ingestion
        logger.warning("Failed to send incident email: %s", exc)
