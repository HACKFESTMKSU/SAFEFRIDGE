# ColdGuard — ESP32 Firmware

Edge firmware for ColdGuard (SRS v2.2) — fridges, cold rooms, and storehouses/warehouses. Reads
DHT11, water sensor, ACS712, publishes MQTT
telemetry per SRS §7, buffers readings in LittleFS during outages (FR-14),
and sends critical GSM SMS via SIM800L when the cloud path is down
(FR-14a/FR-14b).

## Wiring (from SRS §3)

| Sensor / module | Interface | ESP32 pin |
| --- | --- | --- |
| DHT11 | 1-wire digital (10k pull-up to 3.3V) | GPIO 4 |
| Water sensor AO | Analog in | GPIO 34 |
| ACS712 OUT | Analog in (module often 5V) | GPIO 36 |
| SIM800L TXD → ESP32 RX2 | UART | GPIO 16 |
| ESP32 TX2 → SIM800L RXD | UART | GPIO 17 |
| SIM800L VCC / GND | Power | **External 3.7–4.2 V, ≥ 2 A** (LiPo or dedicated buck); common GND with ESP32 |

Rules of thumb:

- **Common GND** for every module.
- 3.3 V for DHT11 / water sensor; 5 V for ACS712
  *if the module requires it*.
- GPIO 34–39 are input-only ADC1 pins — safe to use while Wi-Fi is on.
- **ACS712 on mains is hazardous** — demo with a safe low-voltage DC load.

## Build & flash (PlatformIO)

```bash
cd firmware
pio run -t upload          # build + flash
pio device monitor -b 115200
```

Or override credentials at build time (no need to edit `config.h`):

```bash
pio run -t upload \
  -D WIFI_SSID='"MySSID"' -D WIFI_PASS='"secret"' \
  -D MQTT_HOST='"192.168.1.10"' -D DEVICE_ID='"CG-001"'
```

## Libraries (see `platformio.ini`)

- `adafruit/DHT sensor library` — DHT11 temp/humidity
- `bblanchon/ArduinoJson` **v7** — telemetry/config JSON
- `knolleary/PubSubClient` — MQTT client
- LittleFS — built into the Arduino ESP32 core; used for the offline
  telemetry ring buffer (`/telemetry.log`, max ~200 readings)

## Configuration (`src/config.h`)

Everything is a `#define` at the top of `config.h`; most also accept
`-D` build flags (see `platformio.ini` comments):

| Setting | Default | Notes |
| --- | --- | --- |
| `WIFI_SSID` / `WIFI_PASS` | `YOUR_WIFI` | Replace before flashing |
| `MQTT_HOST` / `MQTT_PORT` | `192.168.x.x` / `1883` | Set to your Mosquitto host |
| `MQTT_USER` / `MQTT_PASS` | empty | Auth optional for the lab broker |
| `MQTT_USE_TLS` | `0` | `1` = WiFiClientSecure on 8883 (insecure skip-verify — pin a CA for prod) |
| `DEVICE_ID` | `CG-001` | Must match the device registered in the backend |
| `SAMPLE_INTERVAL_MS` | `60000` | FR-07 cadence |
| `STATUS_INTERVAL_MS` | `30000` | Heartbeat on `.../status` |
| `ENABLE_SMS` | `1` | Compile gate for all GSM code; `0` builds a GSM-less demo |
| `SMS_RECIPIENTS` | `+254700000000` | Comma-separated, international format |
| `SIM800L_BAUD` | `9600` | Must match the module's `AT+IPR` setting |
| `ASSET_LABEL` | `ColdStorage-1` | Appears in SMS text (SRS FR-14a) |

### Thresholds

Edge-side critical thresholds live in `AlertThresholds` / `DEFAULT_THRESHOLDS`
(`temp_warn_c`, `temp_crit_c`, `temp_low_crit_c`, `water_wet_crit`,
`current_max_a`). These drive **local** critical detection for SMS. The
cloud remains the authority for dashboard incidents (FR-18/19).

A config subscriber is already wired: the device subscribes to
`coldguard/device/{device_id}/config` and accepts JSON like

```json
{"temp_warn_c":8,"temp_crit_c":10,"temp_low_crit_c":-30,
 "water_wet_crit":1,"current_max_a":0,"sms_recipients":"+2547..."}
```

(TODO: persist to LittleFS/NVS so overrides survive reboot.)

## MQTT topics & payload

- `coldguard/device/{device_id}/telemetry` — QoS 1, JSON matching SRS §7
  **exactly**, plus one extra `quality` field (FR-13): `"ok"`, `"dht_nan"`,
  `"temp_implausible"`, `"dht_nan"`, etc. Non-finite floats serialize as
  JSON `null` so the backend can spot gaps.
- `coldguard/device/{device_id}/status` — retained `{device_id, online,
  firmware_version, last_seen}` every ~30 s; also used as the MQTT LWT so
  the broker marks the device offline on ungraceful drops.
- `coldguard/device/{device_id}/config` — inbound threshold config (above).

Example telemetry (SRS §7 shape):

```json
{"device_id":"CG-001","timestamp":"2026-11-12T16:00:00Z",
 "temperature_c":4.5,"humidity_percent":58,"current_a":1.2,
 "water_level":120,"water_wet":false,"firmware_version":"0.1.0","quality":"ok"}
```

## Offline behaviour

- Wi-Fi down / MQTT refused → each reading is appended as a JSON line to
  LittleFS (`/telemetry.log`), capped at ~200 entries (oldest dropped).
- On MQTT reconnect the buffer is replayed **chronologically** (QoS 1);
  if the link drops mid-replay the unsent tail is kept.
- **Critical alert while MQTT is down** → SIM800L SMS:
  `ColdGuard CRITICAL: {asset} {metric}={value} at {ISO8601}` — one SMS per
  alert kind per 15 min cooldown (FR-14b). SMS is *only* sent when the
  MQTT path is down; when online the cloud handles alerting.

## Calibration notes

### ACS712 (current)

- Variant assumed: **5 A module, 185 mV/A** (`ACS712_SENSITIVITY_MV_PER_A`).
  Change to `100.0` (20 A) or `66.0` (30 A) for other modules.
- **Zero offset is auto-calibrated at boot**: power up with *no load*
  (compressor off) and the firmware averages 64 ADC samples into
  `acs712ZeroMv`. For a fixed install, set `ACS712_FIXED_ZERO 1` and tune
  `ACS712_ZERO_RAW`.
- If the module runs at 5 V, `OUT` can exceed the ESP32's 3.3 V ADC range —
  use a divider (e.g. 10 kΩ / 20 kΩ) and set `ACS712_DIVIDER_GAIN` to the
  compensation factor (1.5 for that divider) so mV are scaled back.
- Readings outside ±0.5 A … 30 A are flagged `current_implausible`.

### Water sensor

- `water_level` = raw ADC (0–4095). `water_wet` = raw ≥
  `WATER_WET_THRESHOLD` (default 2000). Calibrate dry/wet values with
  `pio device monitor` and set the threshold mid-way; set
  `WATER_WET_INVERT 1` if the module idles HIGH when dry.

### DHT11

- Coarse accuracy (±2 °C) is fine for demo ranges. Reads are retried once
  on `NaN`; persistent failures publish `null` + `quality:"dht_nan"`.

## SIM800L bring-up

Full AT cheat sheet: [`docs/sim800l-setup.md`](docs/sim800l-setup.md).

**Power warning:** do **not** power SIM800L from the ESP32 3.3 V pin.
Transmit bursts exceed 500 mA and brown out the board. Use an external
3.7–4.2 V supply rated ≥ 2 A (LiPo or buck), common GND, a short thick
power lead, and ~1000 µF across VCC/GND near the module. Attach the
antenna **before** any `AT+CMGS` test. Many boards are 2.8 V logic — a
divider on ESP32 TX (GPIO17) → SIM800L RXD is safer; ESP32 RX usually
works directly.

Quick smoke test (firmware does this automatically at boot):
`AT` → `ATE0` → `AT+CMGF=1` → `AT+CSCS="GSM"` → `AT+CSQ` → `AT+CREG?`.
Set `SIM800L_BAUD` to match the module (common: 9600 or 115200; change
with `AT+IPR=9600` + `AT&W` once).

To test SMS by hand from the monitor, you can temporarily call
`simSendSmsAll("ColdGuard test")` — or just trigger a critical condition
(e.g. warm the DHT11 above `temp_crit_c`) with Wi-Fi disabled.

## Demo script outline

1. **Boot & ingest** — flash, open serial monitor, join lab Wi-Fi,
   confirm `[SENS]` lines and `mosquitto_sub -t 'coldguard/device/CG-001/#' -v`.
2. **Dashboard** — backend stores telemetry; live values + 24 h chart;
   device shows online via `status` heartbeat.
3. **Excursion** — warm DHT11 (or lower thresholds via config topic) →
   backend incident → Operator ack/resolve.
4. **Offline SMS** — disable Wi-Fi (or stop Mosquitto), trigger critical
   temp/water → GSM SMS arrives on the configured phone within one sample
   interval; re-enable Wi-Fi → buffered readings replay, device back online.
5. **Roles** — quick Admin/Operator/Technician permission walkthrough.

## Known limitations / assumptions

- Not compiled against real hardware here — APIs follow ArduinoJson 7 /
  PubSubClient 2.8 / Adafruit lib conventions; verify on first build.
- `quality` is an *extra* field beyond the SRS §7 example (FR-13 asks for
  plausibility flagging; backend should ignore unknown keys).
- ACS712 measures current *draw* of whatever the probe wraps — it is a
  load proxy, not a true energy meter.
- Config overrides from the cloud are volatile (RAM only) — see TODO in
  `mqttCallback`.
- TLS path (`MQTT_USE_TLS=1`) uses `setInsecure()` — acceptable for the
  hackathon, not for production (NFR-03 wants TLS *with* auth in prod).
