# ColdGuard — Prototype Implementation Plan

| Field | Value |
| --- | --- |
| Based on | SRS v2.1 (12 November 2026) |
| Goal | Working demo: ESP32 sensors → MQTT → dashboard → threshold alert for fridges, cold rooms, and agricultural storehouses/warehouses (+ GSM SMS offline) |
| Stack | ESP32 (PlatformIO) · Mosquitto · FastAPI · PostgreSQL · React · email · GSM SMS |
| Hardware | ESP32, DHT11, ACS712, water sensor, SIM800L, breadboard, jumpers |

---

## Principles

1. **Vertical slices** — each phase ends with something you can show.
2. **Build for the kit you own** — include GSM SMS fallback; defer door/battery until you have them.
3. **Three roles only** — Admin, Operator, Technician.
4. **Thresholds before AI** — no ML in the prototype.
5. **Single organization** — no multi-tenant complexity.

---

## Phase map

```text
Phase 0  Project skeleton + auth
Phase 1  Firmware + MQTT ingestion
Phase 2  Assets, dashboard, history
Phase 3  Alerts + incidents (demo-ready)
Phase 4  Offline buffer + GSM SMS + email
```

| Phase | Outcome |
| --- | --- |
| 0 | Compose up; login works; roles exist |
| 1 | Lab ESP32 data lands in the database |
| 2 | Live + 24h charts for one monitored unit (fridge or storehouse zone) |
| 3 | High-temp (or leak) → incident → ack → resolve |
| 4 | Wi-Fi down → GSM SMS; buffer + email; demo script solid |

---

## Phase 0 — Skeleton and auth

**Do**

- Repo layout: `firmware/`, `backend/`, `web/`, `infra/`
- `docker-compose`: PostgreSQL, Mosquitto, backend, (optional Redis later)
- FastAPI: health, config from env, structured logs
- Schema: User, Asset, Device, Telemetry, Incident
- Seed users: one Admin, one Operator, one Technician
- Login + JWT (or session); role middleware
- React app: login shell + empty home

**Exit**

- [ ] Compose starts in one command
- [ ] Each role can log in; protected `/me` returns role
- [ ] Operator cannot hit Admin-only routes

**SRS:** FR-01, FR-02, NFR-03–05

---

## Phase 1 — Edge + ingestion

**Firmware**

- Read DHT11 (temp/humidity), water AO, ACS712 OUT
- Sample every 60s (configurable)
- Publish MQTT JSON matching SRS §7
- Status topic: online heartbeat / firmware version
- Pin map from SRS §3; document calibration for ACS712 zero-current

**Backend**

- MQTT subscriber → validate → insert telemetry + update device `last_seen`
- Reject or flag nonsense values (e.g. temp &lt; -40 or &gt; 80)

**Exit**

- [ ] Serial + MQTT show all core sensors
- [ ] Rows appear in DB; device shows last-seen
- [ ] Wi-Fi connected lab demo works end-to-end for ingest

**SRS:** FR-05–12, FR-17 (backend side)

---

## Phase 2 — Registry and dashboard

**Backend**

- Admin CRUD for assets (name, type, location, temp min/max)
- Link device ↔ asset
- APIs: latest reading, range query, simple aggregates (min/max/avg)

**Frontend**

- Asset list + detail
- Live metrics: temp, humidity, current, water
- 24h chart
- Online/offline badge from last-seen

**Exit**

- [ ] Admin creates asset and attaches device
- [ ] Operator sees live data without Admin menus
- [ ] Technician can open history (read-only)

**SRS:** FR-04–06, FR-15–17, FR-23, NFR-01–02

---

## Phase 3 — Alerts and incidents (core demo)

**Rules**

- Temperature warning/critical with short duration gate (e.g. 1–2 minutes)
- Optional: water wet → incident; current near-zero while “should cool” as simple heuristic
- Auto-create incident; avoid duplicates for same open event

**UX**

- In-app alert list
- Operator: acknowledge → resolve with note
- Suggested actions text (check seal / leak / compressor power)
- Technician: view incidents + optional maintenance note

**Exit**

- [ ] Heat DHT11 or raise threshold → incident appears
- [ ] Wet water probe → leak incident (if enabled)
- [ ] Operator ack + resolve works; Admin sees all

**SRS:** FR-18–21, FR-24, §9 acceptance items 3–5

---

## Phase 4 — Resilience, GSM SMS, email

**Firmware / SIM800L**

- Power SIM800L from external 3.7–4.2V ≥2A + bulk cap; common GND; UART on GPIO 16/17 (`Serial2`)
- AT smoke test: `AT`, `AT+CSQ`, `AT+CREG?`, then `AT+CMGF=1` + `AT+CMGS="..."` SMS send
- On critical local threshold while MQTT/Wi-Fi is down → send short SMS (FR-14a)
- Admin-configured recipient number(s) in firmware config or from last cloud config (FR-14b)
- Rate-limit SMS (e.g. one per critical event / cooldown)
- Firmware ring buffer for short Wi-Fi loss; chronological replay (FR-14)

**Backend / notify**

- Email on new critical incident when cloud path is up
- Dashboard still shows offline from last-seen when Wi-Fi dies

**Docs**

- Wire diagram: SIM800L power/UART, antenna, SIM; pin map; demo script

**Exit**

- [ ] Kill Wi-Fi → device goes offline in UI; buffer replays on reconnect
- [ ] Critical condition with Wi-Fi off → GSM SMS received on test phone
- [ ] Email fires when cloud path is available
- [ ] Full §9 acceptance checklist green (including item 7)

**SRS:** FR-14, FR-14a, FR-14b, FR-22, NFR-05, §9

---

## Explicitly deferred

| Item | Why |
| --- | --- |
| Door, voltage, battery, OTA | Hardware not in kit / too heavy |
| Multi-tenant, MFA, compliance PDF | Too heavy for prototype |
| AI anomaly / forecasting | Thresholds only |
| WhatsApp, webhooks, fleet benchmarking | Post-prototype |
| Cloud SMS (Twilio / Africa’s Talking) | Edge GSM covers offline demo |

---

## Suggested order of work (hackathon)

1. Wire ESP32 + DHT11 first; Serial print.
2. Add water + ACS712; then MQTT publish.
3. Backend ingest + one HTML/React live page.
4. Auth + three roles + asset link.
5. Threshold → incident → ack/resolve.
6. SIM800L AT/SMS smoke test; then Wi-Fi-down critical SMS + buffer + email.

---

## Definition of done

Matches SRS §9:

1. ESP32 publishes DHT11, ACS712, water over MQTT  
2. Dashboard: live + 24h history  
3. Admin thresholds + device↔asset link  
4. Excursion/leak → incident; Operator ack/resolve  
5. Roles enforced on a short demo  
6. Documented local run path  
7. Critical GSM SMS when Wi-Fi is down  

---

## Document control

| Version | Date | Notes |
| --- | --- | --- |
| 1.0 | 11 Nov 2026 | Full commercial phased plan |
| 2.0 | 12 Nov 2026 | Cut to prototype; aligned with actual sensor kit and 3 roles |
| 2.1 | 12 Nov 2026 | Added SIM800L: offline critical SMS in Phase 4 / SRS v2.1 |
