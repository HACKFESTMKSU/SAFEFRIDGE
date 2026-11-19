# ColdGuard

Environmental monitoring for cold rooms, warehouses, and storehouses: ESP32 sensors → MQTT → dashboard → threshold alerts, with GSM SMS when Wi‑Fi is down.

## What it does

ColdGuard watches temperature, humidity, water leaks, and (where fitted) compressor current across **cold rooms, agricultural storehouses, food hubs, and warehouses** holding perishable produce. Staff see live readings and history, get threshold-based incidents, and can acknowledge/resolve them. A vision + LLM agent can characterize the crop in the room and adapt safe bands to that produce. Critical alerts can fall back to SMS via SIM800L if MQTT/Wi‑Fi is unavailable.

**Who it’s for:** farms, markets, food hubs, and warehouse operators protecting stored produce from spoilage when conditions drift. Pharmaceuticals / vaccines are out of scope for this prototype.

## Hardware kit

| Component | Role |
| --- | --- |
| ESP32 | Edge controller, Wi‑Fi, MQTT |
| DHT11 | Temperature + humidity |
| ACS712 | Compressor / load current |
| Water sensor | Leak detection |
| SIM800L | Critical SMS when offline |
| Breadboard + jumpers | Lab wiring |

**Lab power:** ESP32 and sensors from laptop USB‑C. SIM800L SMS demos need a separate strong ~4V supply later (do not power SIM800L from the ESP32 3.3V pin).

Wiring overview: see [`coldguard-esp32-wiring.jpg`](./coldguard-esp32-wiring.jpg). Pin map and requirements are in [`SRS.MD`](./SRS.MD).

## Repo layout

```text
Hackathon_project/
├── web/                      # React + Vite dashboard (mock data MVP)
├── firmware/                 # ESP32 firmware (planned)
├── backend/                  # FastAPI + MQTT ingest (planned)
├── infra/                    # Docker Compose, Mosquitto, Postgres (planned)
├── SRS.MD                    # Requirements
├── IMPLEMENTATION_PLAN.md    # Phased build plan
└── coldguard-esp32-wiring.jpg
```

## Roles

| Role | Access |
| --- | --- |
| Admin | Users, assets, devices, thresholds, everything |
| Operator | Live assets, alerts, ack/resolve incidents |
| Technician | History / diagnostics, maintenance notes |

## Quick start (web UI)

The dashboard currently runs on mock telemetry (no backend required).

```bash
cd web
npm install
npm run dev
```

Open the URL Vite prints (usually `http://localhost:5173`).

### Demo logins

| Role | Email | Password |
| --- | --- | --- |
| Admin | `admin@coldguard.local` | `admin123` |
| Operator | `operator@coldguard.local` | `operator123` |
| Technician | `tech@coldguard.local` | `tech123` |

## Build plan (short)

1. Wire ESP32 + DHT11 → Serial
2. Add water + ACS712 → MQTT publish
3. Backend ingest + live dashboard  
4. Auth + roles + asset link  
5. Thresholds → incidents → ack/resolve  
6. SIM800L SMS when Wi‑Fi is down  

Details: [`IMPLEMENTATION_PLAN.md`](./IMPLEMENTATION_PLAN.md).

## Stack (target)

- **Edge:** ESP32 (PlatformIO / Arduino)
- **Bus:** MQTT (Mosquitto)
- **API:** FastAPI + PostgreSQL
- **Web:** React + Vite
- **Alerts:** In-app, email, GSM SMS fallback

## Deploy (Vercel + Render)

Env placeholders live in [`.env.example`](./.env.example) (root), [`backend/.env.example`](./backend/.env.example), and [`web/.env.example`](./web/.env.example). Copy to `.env` locally; set the same keys in the dashboards for production.

### 1. Backend on Render (Docker)

1. Push this repo to GitHub.
2. [Render](https://render.com) → **New** → **Web Service** → connect the repo.
3. Settings:
   - **Language / Runtime:** Docker
   - **Root Directory:** `backend` (uses `backend/Dockerfile`)
   - **Health Check Path:** `/health`
4. After deploy, open `https://<service>.onrender.com/health` — expect `{"status":"ok",...}`.
5. In **Environment**, set:
   - `JWT_SECRET` = a long random string
   - `CORS_ORIGINS` = your Vercel URL (e.g. `https://coldguard.vercel.app`)
   - `MQTT_ENABLED` = `false` (unless you point at an external broker)
   - `ANTHROPIC_API_KEY` (optional)
   - `RESEND_API_KEY` / `RESEND_FROM` (optional — incident emails)
   - `DATABASE_URL` (optional — leave empty for SQLite demo; paste a Postgres URL for persistence)
6. Free web dynos sleep when idle; first request after sleep can take ~30–60s.

### 2. Frontend on Vercel

1. [Vercel](https://vercel.com) → **Add New Project** → import the repo.
2. Set **Root Directory** to `web`.
3. Framework preset: Vite (see `web/vercel.json`).
4. Environment variable:
   - `VITE_API_URL` = `https://<your-render-service>.onrender.com/api`
5. Deploy. Then go back to Render and set `CORS_ORIGINS` to the Vercel URL if you have not already.

### Cross-link checklist

| Where | Variable | Example |
| --- | --- | --- |
| Vercel | `VITE_API_URL` | `https://coldguard-api.onrender.com/api` |
| Render | `CORS_ORIGINS` | `https://coldguard.vercel.app` |
| Render | `JWT_SECRET` | long random string |
| Render | `ANTHROPIC_API_KEY` | `sk-ant-…` (optional) |
| Render | `RESEND_API_KEY` | `re_…` (optional) |

## Docs

- [Software Requirements (SRS)](./SRS.MD)
- [Implementation plan](./IMPLEMENTATION_PLAN.md)
- [Web app notes](./web/README.md)
- [Backend notes](./backend/README.md)
