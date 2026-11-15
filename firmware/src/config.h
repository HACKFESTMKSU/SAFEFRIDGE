/*
 * ColdGuard firmware configuration
 * ================================
 * All tunables, credentials and pin definitions live here.
 * Change values here (or via PlatformIO build flags, see platformio.ini)
 * before flashing. Do NOT commit real credentials.
 */
#ifndef CONFIG_H
#define CONFIG_H

/* ------------------------------------------------------------------ */
/* Firmware identity                                                    */
/* ------------------------------------------------------------------ */
#define FIRMWARE_VERSION "0.1.0"
#ifndef DEVICE_ID
#define DEVICE_ID "CG-001"          // must match the device registered in the backend
#endif

/* ------------------------------------------------------------------ */
/* Credentials - REPLACE BEFORE FLASHING                                */
/* ------------------------------------------------------------------ */
#ifndef WIFI_SSID
#define WIFI_SSID "Phoenix"        // e.g. "LabWiFi"
#endif
#ifndef WIFI_PASS
#define WIFI_PASS "Crypto.com"   // WPA2 password ("" for open)
#endif

/* MQTT broker */
#ifndef MQTT_HOST
#define MQTT_HOST "192.168.100.5"      // TODO: set to your Mosquitto host/IP
#endif
#ifndef MQTT_PORT
#define MQTT_PORT 1883               // 1883 plain, 8883 TLS
#endif
#ifndef MQTT_USER
#define MQTT_USER ""                 // set for auth; leave empty if broker is open
#endif
#ifndef MQTT_PASS
#define MQTT_PASS ""
#endif

/* Use TLS (WiFiClientSecure, port 8883)? 0 = plain TCP (default, hackathon-simple) */
#ifndef MQTT_USE_TLS
#define MQTT_USE_TLS 0
#endif

/* ------------------------------------------------------------------ */
/* Timing                                                               */
/* ------------------------------------------------------------------ */
#define SAMPLE_INTERVAL_MS   5000UL   // FR-07: sensor read + publish cadence
#define STATUS_INTERVAL_MS   30000UL   // heartbeat on .../status topic
#define RECONNECT_MIN_MS     5000UL    // base backoff for Wi-Fi/MQTT
#define RECONNECT_MAX_MS     60000UL   // max backoff
#define MQTT_BUFFER_SIZE     1024      // PubSubClient TX buffer

/* ------------------------------------------------------------------ */
/* Pin map (SRS §3 - do not change without rewiring)                   */
/* ------------------------------------------------------------------ */
#define PIN_DHT11        4     // DHT11 data (10k pull-up to 3.3V)
#define PIN_I2C_SDA      21    // BMP180 SDA
#define PIN_I2C_SCL      22    // BMP180 SCL
#define PIN_WATER_AO     34    // Water sensor analog out (ADC1, Wi-Fi safe)
#define PIN_MQ3_AO       35    // MQ-3 analog out (optional, ADC1)
#define PIN_ACS712_OUT   36    // ACS712 OUT (ADC1)
#define PIN_SIM800L_RX   16    // ESP32 RX2  <- SIM800L TXD  (GPIO16)
#define PIN_SIM800L_TX   17    // ESP32 TX2  -> SIM800L RXD  (GPIO17)
#define PIN_SIM800L_EN   (-1)  // -1 = not wired; set GPIO if module has PWRKEY/EN

/* ------------------------------------------------------------------ */
/* Sensor calibration                                                   */
/* ------------------------------------------------------------------ */
/* Water sensor: raw ADC counts (0-4095 on ESP32 12-bit ADC) that count as "wet".
 * Calibrate: read dry value, wet value, set threshold mid-way. */
#define WATER_WET_THRESHOLD  2000    // raw ADC counts
#define WATER_LEVEL_MAX      4095
/* 0 = wet when raw >= threshold (pull-down module). Set 1 if the module
 * idles HIGH when dry (active-high output). */
#define WATER_WET_INVERT     0

/* MQ-3 (optional): report raw ADC only; no alerting per FR-11. */
#define ENABLE_MQ3          1       // set 0 to skip reading entirely

/* ACS712 current sensor.
 *  - Variant "5A" : sensitivity 185 mV/A  (most common blue module)
 *  - Variant "20A": sensitivity 100 mV/A
 *  - Variant "30A": sensitivity 66  mV/A
 * Zero-current offset is auto-calibrated at boot (see README). */
#define ACS712_SENSITIVITY_MV_PER_A   185.0f
#define ACS712_ADC_MAX                 4095.0f   // 12-bit ADC
#define ACS712_ADC_VREF_MV             3300.0f   // ADC reference ~3.3V
/* If the ACS712 module runs at 5V, OUT may exceed 3.3V. If you added a
 * resistor divider (e.g. 10k/20k -> 0.66x), set divider gain here so the
 * firmware converts back to module volts. 1.0 = direct wire (3.3V-safe). */
#define ACS712_DIVIDER_GAIN            1.0f
/* Set to 1 to force a fixed zero offset (raw ADC counts) instead of the
 * boot-time auto-calibration. Useful if the load is always connected. */
#define ACS712_FIXED_ZERO             0
#define ACS712_ZERO_RAW               2048     // mid-scale fallback for 3.3V modules

/* DHT11 sanity bounds (FR-13 plausibility) */
#define TEMP_PLAUSIBLE_MIN_C   -40.0f
#define TEMP_PLAUSIBLE_MAX_C    80.0f
#define HUMID_PLAUSIBLE_MIN     0.0f
#define HUMID_PLAUSIBLE_MAX   100.0f
#define PRESSURE_PLAUSIBLE_MIN 300.0f   // hPa
#define PRESSURE_PLAUSIBLE_MAX 1100.0f
#define CURRENT_PLAUSIBLE_MAX_A 30.0f

/* ------------------------------------------------------------------ */
/* Local alert thresholds (FR-18 edge side; cloud keeps the real rules) */
/* These drive FR-14a critical SMS when the link is down.              */
/* ------------------------------------------------------------------ */
typedef struct {
  float temp_warn_c;        // warning temperature (informational)
  float temp_crit_c;        // critical temperature -> SMS if offline
  float temp_low_crit_c;    // freezer-style low-side critical (set very low to disable)
  int   water_wet_crit;     // 1 = wet probe counts as critical
  float current_max_a;      // abnormal-load critical (0 disables)
} AlertThresholds;

static const AlertThresholds DEFAULT_THRESHOLDS = {
  8.0f,      // temp_warn_c   (fridge)
  10.0f,     // temp_crit_c
  -30.0f,    // temp_low_crit_c (effectively disabled for fridge demo)
  1,         // water_wet_crit
  0.0f       // current_max_a (disabled)
};

/* ------------------------------------------------------------------ */
/* Offline buffer (FR-14)                                               */
/* ------------------------------------------------------------------ */
#define BUFFER_MAX_ENTRIES   200       // ~200 readings
#define BUFFER_FILE          "/telemetry.log"   // LittleFS append-only log

/* ------------------------------------------------------------------ */
/* GSM / SIM800L (FR-14a/14b)                                           */
/* ------------------------------------------------------------------ */
/* Compile-time gate: set to 0 to build firmware without any GSM code
 * paths enabled at runtime (still compiles Serial2 helpers harmlessly). */
#define ENABLE_SMS           1

#define SIM800L_BAUD         9600      // match the module's AT+IPR setting
#define SIM_INIT_TIMEOUT_MS  30000     // overall AT init budget
#define SIM_CMD_TIMEOUT_MS   2000      // per-command response wait
#define SIM_SMS_COOLDOWN_MS  (15UL*60UL*1000UL)  // FR-14b rate limit

/* SMS recipients - comma-separated international format, e.g.
 * "+254700000000,+254711111111".  Leave empty to disable SMS sends. */
#ifndef SMS_RECIPIENTS
#define SMS_RECIPIENTS "+254700000000"
#endif
#define SMS_SENDER_TAG     "ColdGuard"  // prepended short tag in message

/* Asset label used in SMS text (SRS: "asset id/name, metric, value, time") */
#ifndef ASSET_LABEL
#define ASSET_LABEL "ColdStorage-1"
#endif

#endif // CONFIG_H
