# ColdGuard — Project Status & Demo Notes

> Cold-storage monitoring for African healthcare & food facilities.
> ESP32 sensors → MQTT → cloud dashboard → threshold incidents → GSM SMS fallback.

---

## 1. The problem we are solving

Cold storage fails **silently**:

- A fridge door left ajar or a failing compressor pushes a unit out of range
  for hours — nobody knows until stock is already spoiled.
- Kenya Power brownouts and rural dead zones kill cloud-only monitors exactly
  when facilities need them most.
- Vaccines (Kenya immunisation programme), insulin and fresh produce are
  expensive — one unnoticed failure writes off an entire batch.

**Our solution:** an IoT device on every cold unit that watches continuously,
alerts the moment readings leave safe bounds, and still sends SMS when
Wi-Fi is down.

---

## 2. IoT architecture (what we built)

```text
┌─────────────────────────────────────────────────────────────┐
│  EDGE — ESP32 (firmware/)                                   │
│  DHT11 temp/humidity · BMP180 pressure · ACS712 current     │
│  Water leak sensor · MQ-3 (optional)                        │
│  SIM800L GSM module → critical SMS when offline             │
│  LittleFS ring buffer → replay readings on reconnect        │
└──────────────┬──────────────────────────────▲───────────────┘
               │ MQTT (JSON, SRS §7)          │ config pushes
               ▼                              │
┌─────────────────────────────────────────────────────────────┐
│  BROKER — Mosquitto / amqtt                                │
│  coldsuite/device/{id}/telemetry|status|config              │
└──────────────┬──────────────────────────────────────────────┘
               ▼
┌─────────────────────────────────────────────────────────────┐
│  CLOUD — FastAPI backend (backend/)                         │
│  • JWT auth, 3 roles (Admin / Operator / Technician)        │
│  • Telemetry validation (implausible readings flagged)      │
│  • Rule engine: sustained-breach gate → incidents           │
│  • device_offline watcher + auto-resolve on recovery        │
│  • Email hook on critical incidents (SMTP optional)         │
│  • PostgreSQL via compose (SQLite for zero-setup dev)       │
└──────────────┬──────────────────────────────────────────────┘
               ▼
┌─────────────────────────────────────────────────────────────┐
│  WEB — React + Vite (web/)                                  │
│  • Public marketing landing page (/welcome)                 │
│  • Live dashboard: metrics, 24h charts, incident workflow   │
│  • Asset/device registry, thresholds & SMS config           │
│  • Maintenance notes, role-gated admin pages                │
└─────────────────────────────────────────────────────────────┘
```

---

## 3. Features built (by SRS phase)

| Phase | Feature | Status |
|---|---|---|
| 0 | FastAPI skeleton, JWT auth, 3 roles enforced on API + UI | ✅ Done |
| 1 | MQTT ingest, telemetry validation, device auto-register | ✅ Done |
| 2 | Asset/device CRUD, thresholds config, live + 24h charts | ✅ Done |
| 3 | Rule engine → incidents → ack/resolve, maintenance notes | ✅ Done |
| 4 | Offline buffer (firmware), SIM800L SMS path, email hook | ⚠️ Code done, needs hardware |

### Firmware highlights (`firmware/`)

- All sensors sampled every 60 s, published as SRS §7 JSON over MQTT QoS 1
- Retained Last-Will status so the broker marks devices offline on drops
- **Offline resilience:** LittleFS ring buffer (~200 readings), chronological
  replay on reconnect
- **GSM SMS:** SIM800L on UART2, AT init independent of Wi-Fi, critical-only
  SMS with 15-min rate limit, recipient list from cloud config topic
- Remote threshold config via `coldguard/device/{id}/config`

### Backend highlights (`backend/`)

- ~20 REST endpoints under `/api` matching frontend types exactly
- Sustained-breach gate (2 consecutive readings) before incidents — kills flapping
- Duplicate suppression while an incident is open
- `device_offline` incidents auto-resolve when telemetry returns
- Suspect readings (`quality="suspect"`) stored but never trigger alerts (FR-13)

### Frontend highlights (`web/`)

- Marketing landing page with Kenya-focused problem/solution narrative,
  auto-playing image slider, Africa photography
- Real API wiring: JWT auth, 15 s metadata polling + 60 s telemetry refresh,
  live "API connected" indicator
- Demo logins: `admin@` / `operator@` / `tech@coldguard.local`

---

## 4. Problems we solved along the way

| Problem | Fix |
|---|---|
| Frontend was mock-only | Built full FastAPI backend + rewired UI to real JWT API |
| No persistence across refresh | JWT in localStorage + server-side DB |
| Offline device incidents never closed | Found & fixed missing `db.commit()` in auto-resolve |
| Rule engine could spam incidents | Sustained-breach gate + duplicate suppression |
| Nonsense sensor values triggering alerts | Plausibility checks → `quality="suspect"` flag |
| Wi-Fi down = blind system | Firmware ring buffer + SIM800L GSM SMS fallback |
| JWT secret too short (PyJWT warning) | Lengthened dev default to ≥32 bytes |
| No way to demo without hardware | `simulate_device.py` — full MQTT device simulator |
| Push to org repo denied | Collaborator access granted → branch pushed |

---

## 5. Live demo script (5 min)

```bash
# Terminal 1 — MQTT broker (no Docker needed)
pip install amqtt && amqtt

# Terminal 2 — backend
cd backend && python -m uvicorn app.main:app --port 8000

# Terminal 3 — frontend
cd web && npm run dev
```

1. Open `localhost:5173` → landing page → **Live demo**
2. Login as `admin@coldguard.local` / `admin123`
3. Dashboard shows live assets, incidents, device status
4. **Simulate live data:**
   `cd backend && python -u scripts/simulate_device.py`
5. **Simulate a failure:**
   `python -u scripts/simulate_device.py --temp 12.5 --interval 10`
   → critical incident appears in ~30 s
6. As `operator@coldguard.local` → acknowledge → resolve with note
7. **Simulate Wi-Fi loss:** `--offline 120` → device_offline incident

---

## 6. Repo layout

```text
SAFEFRIDGE/
├── SRS.MD                      # Requirements v2.1
├── IMPLEMENTATION_PLAN.md      # Phased plan
├── PRESENTATION.md             # ← this file
├── backend/                    # FastAPI + SQLAlchemy + MQTT + rules
│   └── scripts/simulate_device.py
├── firmware/                   # PlatformIO ESP32 (sensors + SMS)
├── infra/                      # docker-compose: Postgres + Mosquitto
└── web/                        # React + Vite dashboard + landing page
```

## 7. What's next (Phase 4 hardware)

- Flash firmware to a real ESP32 (`pio run -t upload`)
- Bench-calibrate ACS712 zero offset & water threshold
- SIM800L AT smoke test → critical SMS on Wi-Fi-down demo
- Optional: MQTT auth hardening, Postgres migration, OTA updates
