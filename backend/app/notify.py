"""Email notification hook (FR-19 / FR-22).

Sends email via Resend when RESEND_API_KEY is set; otherwise logs the
notification so the demo still shows incidents in-app.
"""

import html
import logging

import resend
from sqlalchemy import select
from sqlalchemy.orm import Session

from .config import settings
from .models import Asset, Incident, User

logger = logging.getLogger("coldguard.notify")


def _is_deliverable(email: str) -> bool:
    """Skip seeded demo addresses Resend cannot deliver to."""
    e = email.strip().lower()
    if "@" not in e or e.startswith("@"):
        return False
    # .local / placeholder domains are for login demos only
    return not e.endswith((".local", ".test", ".example", ".invalid"))


def _recipients(db: Session, asset: Asset) -> list[str]:
    emails = [e.strip() for e in settings.NOTIFY_EMAILS.split(",") if e.strip()]
    # Also notify operator/admin users that have a real email on file.
    users = db.scalars(select(User).where(User.role.in_(["operator", "admin"]))).all()
    emails += [u.email for u in users if u.email]
    return sorted({e for e in emails if _is_deliverable(e)})


def _html_body(asset_name: str, incident: Incident, text_body: str) -> str:
    safe = html.escape(text_body).replace("\n", "<br>\n")
    return (
        f"<h2>ColdGuard incident</h2>"
        f"<p><strong>{html.escape(asset_name)}</strong> — "
        f"{html.escape(incident.severity.upper())}</p>"
        f"<p>{safe}</p>"
    )


def notify_incident(db: Session, incident: Incident) -> None:
    """Called when a new incident is created. Email when Resend is configured."""
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

    if not settings.RESEND_API_KEY or not to:
        logger.info("Resend not configured — incident %s logged only.\n%s", incident.id, body)
        return

    resend.api_key = settings.RESEND_API_KEY
    try:
        # resend-python: idempotency lives in the options dict (2nd arg), not a kwarg
        result = resend.Emails.send(
            {
                "from": settings.RESEND_FROM,
                "to": to,
                "subject": subject,
                "text": body,
                "html": _html_body(asset_name, incident, body),
            },
            {"idempotency_key": f"incident-notify/{incident.id}"},
        )
        email_id = result.get("id") if isinstance(result, dict) else getattr(result, "id", None)
        logger.info("Incident notification emailed to %s (id=%s)", to, email_id)
    except Exception as exc:  # never let notify break ingestion
        logger.warning("Failed to send incident email via Resend: %s", exc)
