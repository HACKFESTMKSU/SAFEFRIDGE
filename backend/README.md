# ColdGuard Backend

FastAPI + SQLAlchemy backend for ColdGuard — agricultural cold rooms, storehouses,
food hubs, and warehouses. Covers auth/roles, MQTT telemetry, assets/devices,
threshold rules, incidents, and the produce vision agent (YOLOE-26 + Claude).

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

Seeded lab asset: **Lab produce storehouse** linked to device `CG-001`.

## Configuration (`.env`)

See `.env.example`. Key vars:

- `DATABASE_URL` — defaults to SQLite. For production use the **Supabase
  Transaction pooler** URI (`…pooler.supabase.com:6543/postgres`).
  `postgres://` / `postgresql://` URLs are rewritten to `postgresql+psycopg://`.
  Pooler hosts auto-enable `prepare_threshold=None` (or set `DATABASE_POOLER=true`).
- `CORS_ORIGINS` — comma-separated production frontends (e.g. Vercel URL);
  localhost Vite ports are always allowed
- `MQTT_ENABLED`, `MQTT_HOST`, `MQTT_PORT`, `MQTT_USERNAME`, `MQTT_PASSWORD`
- `RULE_CONSECUTIVE_BREACHES` (default 2) — sustained-breach gate before an
  incident is created; `RULE_BREACH_WINDOW_SECONDS` (default 600)
- `DEVICE_OFFLINE_SECONDS` (default 300) — silence before `device_offline`
- `RESEND_API_KEY` / `RESEND_FROM` / `NOTIFY_EMAILS` — Resend email on new
  incidents; logged only if the API key is unset
- `JWT_SECRET`, `JWT_EXPIRE_MINUTES`
- `ANTHROPIC_API_KEY` / `ANTHROPIC_MODEL` — Claude agent for produce guidance (optional; static catalog fallback without a key)
- `VISION_MODEL` — Ultralytics weight hint (default YOLOE-26 small seg)

## Deploy (Render — Docker)

Create a **Web Service** with **Runtime: Docker**, **Root Directory:** `backend`
(builds `Dockerfile`). Health check: `/health`. Set `CORS_ORIGINS` to your
Vercel URL. For live ESP32 readings set `MQTT_ENABLED=true`,
`MQTT_HOST=broker.emqx.io`, `MQTT_PORT=1883` (matches the Arduino lab sketch).
HTTP fallback: `POST /api/telemetry/ingest` with the same JSON payload.
Full steps: root [README](../README.md#deploy-vercel--render).

```bash
# Local smoke-test of the same image Render will run
docker build -t coldguard-api .
docker run --rm -p 8000:8000 -e MQTT_ENABLED=false coldguard-api
```

## Produce vision agent

- `GET /api/assets/produce/profiles` — agri crop catalog + safe bands
- `POST /api/assets/{id}/characterize` — multipart `file` (short video) → YOLOE-26 frames → Claude/static → apply thresholds
- `POST /api/assets/{id}/produce` — `{ "productKey": "tomato" }` manual profile apply
- Demo uses **video upload**; production path is ESP32-CAM into the same loop.
- Without Ultralytics installed, **manual produce pick** still applies thresholds; vision falls back gracefully.
- Optional vision stack (large download — prefer CPU torch):

```bash
pip install torch --index-url https://download.pytorch.org/whl/cpu
pip install -r requirements-vision.txt
```

First vision run also downloads `yoloe-26s-seg.pt` (needs network).

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
  `GET /assets/produce/profiles`, `POST /assets/{id}/characterize`,
  `POST /assets/{id}/produce`, `GET/POST /assets/{id}/notes`
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
