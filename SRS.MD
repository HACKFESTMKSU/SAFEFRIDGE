# Software Requirements Specification

**ColdGuard** — Cold-Storage Monitoring Prototype

| Field | Value |
| --- | --- |
| Version | 2.1 |
| Date | 12 November 2026 |
| Status | Prototype / hackathon scope |
| Based on | Available lab hardware (ESP32 + sensors + GSM) |

---

## 1. Introduction

### 1.1 Purpose

ColdGuard is a prototype that monitors a refrigerator or small cold-storage unit using an ESP32 and common sensors, shows live readings on a web dashboard, and alerts when conditions look unsafe.

This document defines what the prototype must do. It is intentionally smaller than a commercial product SRS.

### 1.2 Scope

**In scope**

- One ESP32 edge device with the sensors listed in §3
- Wi-Fi + MQTT telemetry to a cloud/backend
- Web dashboard: live status, short history, simple alerts
- Three user roles: Admin, Operator, Technician
- Threshold-based alerts (temperature, humidity, water leak, abnormal current)
- Basic incident acknowledge / resolve flow
- In-app + email notifications
- GSM module SMS for critical alerts when Wi-Fi/MQTT is unavailable

**Out of scope for this prototype**

- Multi-tenant / multi-organization SaaS
- Door sensors, dedicated voltage sensing, battery/UPS backup, OTA fleet management
- Full AI/ML forecasting and compliance/audit exports
- WhatsApp, webhooks, billing, custom roles
- Production scale (thousands of devices)

### 1.3 Users (maximum 3 roles)

| Role | Who | Can do |
| --- | --- | --- |
| **Admin** | System owner | Manage users, assets, devices, thresholds, view everything |
| **Operator** | Facility staff | View assigned assets, receive alerts, acknowledge and resolve incidents |
| **Technician** | Maintenance helper | View asset history and diagnostics; add maintenance notes |

### 1.4 Definitions

| Term | Meaning |
| --- | --- |
| Asset | One fridge / freezer / cold box being monitored |
| Device | The ESP32 unit attached to an asset |
| Telemetry | Timestamped sensor readings |
| Excursion | Temperature (or other metric) outside configured limits |
| Incident | An alert that needs acknowledgement and resolution |

---

## 2. Product overview

```text
Fridge / cold unit
        |
        v
 ESP32 + sensors
   |           |
   | Wi-Fi     | GSM (critical SMS fallback)
   | MQTT      v
   v         Operator phone
 Backend (API + DB + rules)
        |
        v
 Web dashboard + email alerts
```

**Prototype story:** staff see fridge climate, compressor current, and water leaks in one place; get notified when temperature drifts or a leak is detected — including SMS via GSM if Wi-Fi is down.

---

## 3. Hardware (what we have)

| Component | Role in ColdGuard |
| --- | --- |
| **ESP32** | Edge controller, Wi-Fi, MQTT publish |
| **DHT11** | Temperature + humidity (primary climate sensor) |
| **ACS712** | Current draw (compressor / load proxy) |
| **Water sensor** | Leak / overflow detection |
| **SIM800L** | Critical SMS when Wi-Fi/MQTT is down |
| Breadboard + jumpers | Lab wiring |
| SIM card (unlocked) + antenna | Required for SIM800L SMS demos |

**Not available this prototype:** door reed switch, dedicated voltage sensor, UPS/battery pack. Related commercial features are deferred.

### Wiring summary (lab)

| Sensor / module | Typical interface | Suggested ESP32 pins |
| --- | --- | --- |
| DHT11 | Digital 1-wire | GPIO 4 |
| Water AO | Analog | GPIO 34 |
| ACS712 OUT | Analog (module often 5V) | GPIO 36 |
| SIM800L TX / RX | UART | GPIO 17 (ESP32 TX) → SIM800L RXD, GPIO 16 (ESP32 RX) ← SIM800L TXD |
| SIM800L VCC / GND | Power | External **3.7–4.2V**, ≥**2A** capable (LiPo or dedicated buck); common GND with ESP32 |

Common GND for all modules. Use 3.3V for DHT11/water where rated; 5V for ACS712 if required by the module. Prefer ADC1 pins (34–39) when Wi-Fi is on.

**SIM800L notes**

- Do **not** power from the ESP32 3.3V pin — transmit bursts brown out the board.
- Use a short, thick power wire and a large capacitor (e.g. 1000µF) across SIM800L VCC/GND near the module.
- Attach the antenna before `AT+CMGS` SMS tests.
- Logic is ~2.8V on many boards; ESP32 3.3V UART usually works for RX, but a divider on ESP32 TX → SIM800L RX is safer if the module is 2.8V-only.
- Insert an unlocked SIM with SMS credit; set baud (often 9600 or 115200) to match firmware `Serial2`.

**ACS712 on mains is hazardous** — demo with a safe low-voltage DC load unless a qualified person handles AC.

---

## 4. Functional requirements

Priorities: **M** = must for prototype · **S** = should if time · **C** = nice later

### 4.1 Auth and roles

| ID | Requirement | Priority |
| --- | --- | --- |
| FR-01 | Email/password login. Seeded Admin account for demos. | M |
| FR-02 | Enforce Admin / Operator / Technician permissions on API and UI. | M |
| FR-03 | Users can change password and basic profile (name, phone). | S |

No multi-tenant isolation in this prototype — single organization.

### 4.2 Assets and devices

| ID | Requirement | Priority |
| --- | --- | --- |
| FR-04 | Admin can create/edit an asset (name, type, location, temp min/max). | M |
| FR-05 | Admin can register a device ID and link it to one asset. | M |
| FR-06 | System stores device last-seen time and online/offline status. | M |

### 4.3 Sensing and telemetry

| ID | Requirement | Priority |
| --- | --- | --- |
| FR-07 | Device reads DHT11 temperature and humidity on a configurable interval (default 60s). | M |
| FR-09 | Device reads ACS712 current and publishes amperage (calibrated in firmware). | M |
| FR-10 | Device reads water sensor; publishes wet/dry or analog level. | M |
| FR-12 | Device publishes JSON telemetry over MQTT; backend stores readings. | M |
| FR-13 | Device flags disconnected or implausible readings where practical. | S |
| FR-14 | Short local buffer when Wi-Fi drops; replay when back online. | S |
| FR-14a | When Wi-Fi/MQTT is unavailable, device sends a short critical SMS via GSM (asset id/name, metric, value, time). | S |
| FR-14b | GSM SMS rate-limited to avoid spam; Admin configures recipient phone number(s). | S |

### 4.4 Dashboard

| ID | Requirement | Priority |
| --- | --- | --- |
| FR-15 | Live view of latest temp, humidity, current, water status. | M |
| FR-16 | Simple history charts (at least last 24 hours). | M |
| FR-17 | Show device online/offline and last-seen. | M |

### 4.5 Alerts and incidents

| ID | Requirement | Priority |
| --- | --- | --- |
| FR-18 | Admin configures warning/critical temperature thresholds and optional humidity / water / current rules. | M |
| FR-19 | Sustained threshold breach creates an incident and notifies Operators (in-app + email). | M |
| FR-20 | Operator can acknowledge then resolve an incident with a short note. | M |
| FR-21 | Simple recommended actions (e.g. check door/seal, inspect for leak, check power/compressor). | S |
| FR-22 | Cloud/email SMS path optional; edge GSM SMS is the primary offline alert path (see FR-14a). | S |

### 4.6 Technician

| ID | Requirement | Priority |
| --- | --- | --- |
| FR-23 | Technician can view asset telemetry and incident history. | M |
| FR-24 | Technician can add a maintenance note on an asset or incident. | S |

---

## 5. Non-functional requirements (prototype)

| ID | Requirement | Priority |
| --- | --- | --- |
| NFR-01 | Dashboard usable on laptop and phone browser. | M |
| NFR-02 | Telemetry from lab device appears in UI within a few seconds under normal Wi-Fi. | M |
| NFR-03 | HTTPS for web; MQTT with auth (TLS preferred if certs available). | M |
| NFR-04 | Passwords hashed; role checks on every protected API route. | M |
| NFR-05 | Stack runs locally via Docker Compose for demos. | M |

Commercial SLAs (99.5% uptime, 10k devices, etc.) are out of scope.

---

## 6. Software stack (target)

| Layer | Choice |
| --- | --- |
| Firmware | Arduino / PlatformIO on ESP32 |
| Broker | Mosquitto |
| Backend | FastAPI |
| DB | PostgreSQL (Timescale optional) |
| Frontend | React |
| Notify | Email (SMTP); edge GSM SMS for offline critical alerts |

---

## 7. Data (minimal)

| Entity | Purpose |
| --- | --- |
| User | id, email, name, role, password hash |
| Asset | id, name, type, location, thresholds, status |
| Device | id, asset_id, firmware, last_seen, online |
| Telemetry | device_id, timestamp, metrics JSON or columns, quality |
| Incident | id, asset_id, type, severity, status, timestamps, notes |
| AuditLog | optional: login, threshold change, ack/resolve |

**Example MQTT telemetry**

```json
{
  "device_id": "CG-001",
  "timestamp": "2026-11-12T16:00:00Z",
  "temperature_c": 4.5,
  "humidity_percent": 58,
  "current_a": 1.2,
  "water_level": 120,
  "water_wet": false,
  "firmware_version": "0.1.0"
}
```

Topics (single org):

```text
coldguard/device/{device_id}/telemetry
coldguard/device/{device_id}/status
```

---

## 8. Main workflows

**Normal monitoring:** sensors → MQTT → store → dashboard refresh → rules evaluate.

**Excursion:** temp (or water/current rule) out of range for configured duration → incident → notify Operator (in-app/email) → ack → note → resolve.

**Offline critical:** Wi-Fi/MQTT down and a critical threshold fires locally → ESP32 sends GSM SMS to configured Operator number(s); buffer readings until reconnect.

---

## 9. Acceptance (prototype done when)

1. ESP32 publishes DHT11, ACS712, and water readings over MQTT.
2. Backend stores readings; dashboard shows live + 24h history.
3. Admin can set temperature thresholds and link a device to an asset.
4. Simulated high temperature creates an incident; Operator can ack and resolve.
5. Admin / Operator / Technician permissions behave correctly on a short demo script.
6. Stack starts with documented compose / run steps.
7. With Wi-Fi disabled, a critical condition triggers at least one GSM SMS to a configured number (SIM inserted, network available).

---

## 10. Risks (short)

| Risk | Mitigation |
| --- | --- |
| DHT11 accuracy is coarse | Demo ranges, not medical certification claims |
| ACS712 / mains safety | Use safe DC load for demos |
| False water noise | Calibrate wet/dry thresholds on the water probe |
| Wi-Fi drop | Short buffer + GSM SMS + show offline on dashboard |
| SIM800L brownout / weak signal | 2A 4V supply + big cap + antenna; fallback to in-app when online |

---

## 11. Future (after prototype)

Door sensor, power-loss detection, battery backup, multi-site tenants, AI anomaly detection, PDF compliance reports, OTA updates, cloud SMS providers as secondary path.
