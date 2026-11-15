# ColdGuard

Cold-storage monitoring prototype: ESP32 sensors → MQTT → dashboard → threshold alerts, with GSM SMS when Wi‑Fi is down.

## What it does

Monitor a fridge or small cold unit for temperature and humidity (DHT11 first), then pressure, compressor current, and water leaks. Staff see live readings and history, get threshold-based incidents, and can acknowledge/resolve them. Critical alerts can fall back to SMS via SIM800L if MQTT/Wi‑Fi is unavailable.

## Hardware kit

| Component | Role |
| --- | --- |
| ESP32 | Edge controller, Wi‑Fi, MQTT |
| DHT11 | Temperature + humidity |
| BMP180 | Pressure + secondary temp |
| ACS712 | Compressor / load current |
| Water sensor | Leak detection |
| MQ-3 | Optional vapor demo (no MVP alerts) |
| SIM800L | Critical SMS when offline |
| Breadboard + jumpers | Lab wiring |

**Lab power:** ESP32 and sensors from laptop USB‑C. SIM800L SMS demos need a separate strong ~4V supply later (do not power SIM800L from the ESP32 3.3V pin).

Wiring overview: see [`coldguard-esp32-wiring.jpg`](./coldguard-esp32-wiring.jpg). Pin map and requirements are in [`SRS.MD`](./SRS.MD).

## Repo layout

```text
Hackathon_project/
├── web/                      # React + Vite dashboard (API-backed)
├── backend/                  # FastAPI + MQTT ingest + Postgres
├── firmware/                 # ESP32 Arduino examples
├── infra/                    # Docker Compose (Postgres, Mosquitto, API)
├── SRS.MD
└── IMPLEMENTATION_PLAN.md
```

## Roles

| Role | Access |
| --- | --- |
| Admin | Users, assets, devices, thresholds, everything |
| Operator | Live assets, alerts, ack/resolve incidents |
| Technician | History / diagnostics, maintenance notes |

## Quick start

### 1. Infra + API

```bash
cd infra
docker compose up --build -d
```

API: `http://localhost:8000` · docs: `http://localhost:8000/docs`  
MQTT broker: `localhost:1883`  
Postgres: `localhost:15432` (user/pass/db: `coldguard`)

### 2. Web UI

```bash
cd web
npm install
npm run dev
```

Open the URL Vite prints (usually `http://localhost:5173`).

### Seed logins

| Role | Email | Password |
| --- | --- | --- |
| Admin | `admin@coldguard.app` | `admin123` |
| Operator | `operator@coldguard.app` | `operator123` |
| Technician | `tech@coldguard.app` | `tech123` |

Seed also creates device **CG-001** linked to asset **Lab Cold Unit**.

### 3. Send a DHT11 reading (without ESP32 yet)

```bash
TOKEN=$(curl -s -X POST http://localhost:8000/api/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"admin@coldguard.app","password":"admin123"}' | jq -r .access_token)

curl -s -X POST http://localhost:8000/api/telemetry/ingest \
  -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"device_id":"CG-001","temperature_c":23.9,"humidity_percent":71}'
```

Or publish MQTT:

```bash
mosquitto_pub -h localhost -t coldguard/device/CG-001/telemetry \
  -m '{"device_id":"CG-001","temperature_c":23.9,"humidity_percent":71}'
```

Refresh the dashboard — temp/humidity should appear on Lab Cold Unit.

### 4. ESP32 firmware

Use [`firmware/dht11_mqtt_example.ino`](./firmware/dht11_mqtt_example.ino): set Wi‑Fi, set `MQTT_HOST` to your PC’s LAN IP, flash, and watch readings land in the UI.

## Current phase

- Frontend uses the live API (no mock telemetry).
- Backend ingests **DHT11 temperature + humidity** over MQTT (and HTTP ingest for lab tests).
- BMP180 / ACS712 / water / SMS come in later phases.

## Stack

- **Edge:** ESP32 (Arduino)
- **Bus:** MQTT (Mosquitto)
- **API:** FastAPI + PostgreSQL
- **Web:** React + Vite

## Docs

- [Software Requirements (SRS)](./SRS.MD)
- [Implementation plan](./IMPLEMENTATION_PLAN.md)
- [Web app notes](./web/README.md)
