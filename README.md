# ColdGuard

Cold-storage monitoring prototype: ESP32 sensors → MQTT → dashboard → threshold alerts, with GSM SMS when Wi‑Fi is down.

## What it does

Monitor a fridge or small cold unit for temperature, humidity, pressure, compressor current, and water leaks. Staff see live readings and history, get threshold-based incidents, and can acknowledge/resolve them. Critical alerts can fall back to SMS via SIM800L if MQTT/Wi‑Fi is unavailable.

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

1. Wire ESP32 + DHT11 + BMP180 → Serial  
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

## Docs

- [Software Requirements (SRS)](./SRS.MD)
- [Implementation plan](./IMPLEMENTATION_PLAN.md)
- [Web app notes](./web/README.md)
