# ColdGuard Backend

FastAPI + SQLAlchemy backend for the ColdGuard cold-storage monitoring prototype.
Covers SRS phases 0–3: auth/roles, MQTT telemetry ingest, asset/device registry,
live + history APIs, threshold rule engine, and incident ack/resolve flow.

## Quick start

```bash
cd backend
python -m venv .venv && .venv\Scripts\activate   # Windows
pip install -r requirements.txt
copy .env.example .env                            # optional; SQLite works out of the box
uvicorn app.main:app --reload --port 8000
```

API docs: http://localhost:8000/docs · Health: http://localhost:8000/health

The app creates tables and seeds demo data on first start (SQLite file
`coldguard.db` by default — delete it to re-seed).

## Seeded logins

| Role        | Email                     | Password      |
| ----------- | ------------------------- | ------------- |
| Admin       | admin@coldguard.local     | admin123      |
| Operator    | operator@coldguard.local  | operator123   |
| Technician  | tech@coldguard.local      | tech123       |

Seeded assets/devices/incidents/notes mirror `web/src/data/mock.ts`
(Pharmacy Fridge A / CG-001, Vaccine Freezer B / CG-002, Lab Cold Box).

## Configuration (`.env`)

See `.env.example`. Key vars:

- `DATABASE_URL` — defaults to SQLite; use
  `postgresql+psycopg://coldguard:coldguard@localhost:5432/coldguard` for Postgres.
- `MQTT_ENABLED`, `MQTT_HOST`, `MQTT_PORT`, `MQTT_USERNAME`, `MQTT_PASSWORD`
- `RULE_CONSECUTIVE_BREACHES` (default 2) — sustained-breach gate before an
  incident is created; `RULE_BREACH_WINDOW_SECONDS` (default 600)
- `DEVICE_OFFLINE_SECONDS` (default 300) — silence before `device_offline`
- `SMTP_*` / `NOTIFY_EMAILS` — email on new incidents; logged only if unset
- `JWT_SECRET`, `JWT_EXPIRE_MINUTES`

## MQTT

Subscribes to `coldguard/device/{id}/telemetry` and `.../status` (SRS §7).
Telemetry payload is validated; implausible values (e.g. temp < -40 or > 80)
are stored with `quality="suspect"` and never trigger incidents (FR-13).
Unknown device IDs are auto-registered.

No Docker? Run a local broker with `pip install amqtt` then `amqtt`
(listens on `:1883`, anonymous — same as the compose demo config).

## API overview (all under `/api`)

- `POST /auth/login`, `GET /auth/me`, `PATCH /auth/me`, `POST /auth/change-password`
- `GET/POST /assets`, `PATCH /assets/{id}`, `POST /assets/{id}/link-device`,
  `DELETE /assets/{id}/link-device`, `PATCH /assets/{id}/thresholds`,
  `GET/POST /assets/{id}/notes`
- `GET/POST /devices`, `PATCH /devices/{id}`
- `GET /telemetry/{device_id}?hours=24`, `GET /telemetry/{device_id}/latest`,
  `GET /telemetry/{device_id}/stats`
- `GET /incidents` (`?status=&severity=&asset=`), `GET /incidents/{id}`,
  `POST /incidents/{id}/acknowledge`, `POST /incidents/{id}/resolve {note}`,
  `POST /incidents/{id}/notes`
- `GET/POST/PATCH /users` (admin only)
- `GET /dashboard/summary`

Roles: admin = everything; operator = read + ack/resolve + notes;
technician = read + notes only.
