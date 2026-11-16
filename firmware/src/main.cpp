/*
 * ColdGuard - ESP32 edge firmware
 * =================================
 * Reads DHT11 / water / ACS712, publishes
 * telemetry JSON over MQTT per SRS §7, buffers readings in LittleFS when
 * the link is down (FR-14), and sends critical GSM SMS via SIM800L when
 * Wi-Fi/MQTT is unavailable (FR-14a/FR-14b).
 *
 * Build:    pio run -t upload          (from firmware/)
 * Monitor:  pio device monitor -b 115200
 *
 * Assumptions (see README):
 *  - ArduinoJson 7, PubSubClient 2.8, Adafruit DHT lib.
 *  - LittleFS partition present (default Arduino ESP32 partition scheme).
 *  - ACS712 "5A" variant, 185 mV/A, zero auto-calibrated at boot.
 */

#include <Arduino.h>
#include <WiFi.h>
#include <WiFiClient.h>
#include <PubSubClient.h>
#if MQTT_USE_TLS
  #include <WiFiClientSecure.h>
#endif
#include <ArduinoJson.h>
#include <Adafruit_Sensor.h>
#include <DHT.h>
#include <LittleFS.h>
#include <time.h>
#include <string.h>

#include "config.h"

/* ================================================================== */
/* Globals                                                             */
/* ================================================================== */
DHT              dht(PIN_DHT11, DHT11);

#if MQTT_USE_TLS
WiFiClientSecure tlsClient;
PubSubClient mqtt(tlsClient);
#else
WiFiClient wifiClient;
PubSubClient mqtt(wifiClient);
#endif

/* Timing / link state */
static unsigned long lastSampleMs    = 0;
static unsigned long lastStatusMs    = 0;
static unsigned long lastMqttRetryMs = 0;
static unsigned long backoffMs       = RECONNECT_MIN_MS;
static bool wifiConnected  = false;
static bool mqttConnected  = false;

/* Threshold config - edge copy; cloud config topic can override (see TODO) */
static AlertThresholds thresholds = DEFAULT_THRESHOLDS;

/* ACS712 calibration */
static float acs712ZeroMv    = 0.0f;
static bool  acs712Calibrated = false;

/* SMS state */
static bool sim_enabled     = false;   // runtime gate (also compile-gated by ENABLE_SMS)
static bool sim_ready       = false;
static unsigned long simLastRetryMs = 0;
static char gSmsRecipients[160] = "";  // runtime override from cloud config

static String smsRecipientList() {
  return (strlen(gSmsRecipients) > 0) ? String(gSmsRecipients) : String(SMS_RECIPIENTS);
}

/* SMS rate limiting: one SMS per alert kind per cooldown (FR-14b) */
enum AlertKind { ALERT_TEMP_HIGH, ALERT_TEMP_LOW, ALERT_WATER, ALERT_CURRENT, ALERT_COUNT };
static unsigned long lastSmsMs[ALERT_COUNT] = {0, 0, 0, 0};

/* ================================================================== */
/* Small helpers                                                       */
/* ================================================================== */
static String iso8601utc() {
  time_t now = time(nullptr);
  if (now < 100000) {                       // SNTP not synced yet
    char buf[32];
    snprintf(buf, sizeof(buf), "uptime+%lus", (unsigned long)(millis() / 1000));
    return String(buf);
  }
  struct tm* tmv = gmtime(&now);
  char buf[25];
  strftime(buf, sizeof(buf), "%Y-%m-%dT%H:%M:%SZ", tmv);
  return String(buf);
}

static void logMsg(const char* tag, const String& msg) {
  Serial.printf("[%s] %s\n", tag, msg.c_str());
}

/* ================================================================== */
/* Wi-Fi                                                               */
/* ================================================================== */
static void wifiEnsureConnected() {
  if (WiFi.status() == WL_CONNECTED) { wifiConnected = true; return; }
  wifiConnected = false;

  static unsigned long lastTry = 0;
  if (millis() - lastTry < backoffMs) return;
  lastTry = millis();

  logMsg("WIFI", "connecting ...");
  WiFi.mode(WIFI_STA);
  WiFi.begin(WIFI_SSID, WIFI_PASS);
  unsigned long start = millis();
  while (WiFi.status() != WL_CONNECTED && millis() - start < 15000) {
    delay(250);
  }
  if (WiFi.status() == WL_CONNECTED) {
    wifiConnected = true;
    backoffMs = RECONNECT_MIN_MS;
    logMsg("WIFI", String("connected, IP=") + WiFi.localIP().toString());
    configTime(0, 0, "pool.ntp.org", "time.nist.gov");   // SNTP -> ISO8601 UTC
  } else {
    logMsg("WIFI", "connect failed; retry with backoff");
    backoffMs = min(backoffMs * 2, RECONNECT_MAX_MS);
  }
}

/* ================================================================== */
/* MQTT                                                                */
/* ================================================================== */
static String topicTelemetry() { return String("coldguard/device/") + DEVICE_ID + "/telemetry"; }
static String topicStatus()    { return String("coldguard/device/") + DEVICE_ID + "/status"; }
static String topicConfig()    { return String("coldguard/device/") + DEVICE_ID + "/config"; }

static void mqttCallback(char* topic, byte* payload, unsigned int length) {
  /* Remote threshold/SMS config push.
   * TODO(FR-18): expand to full admin-managed config (humidity/current rules,
   *              sustained-breach duration) once backend config API exists.
   * Example payload:
   * {"temp_warn_c":8,"temp_crit_c":10,"temp_low_crit_c":-30,
   *  "water_wet_crit":1,"current_max_a":0,"sms_recipients":"+2547..."} */
  if (strcmp(topic, topicConfig().c_str()) != 0) return;

  JsonDocument doc;
  if (deserializeJson(doc, payload, length) != DeserializationError::Ok) {
    logMsg("MQTT", "config JSON parse failed");
    return;
  }
  if (doc["temp_warn_c"].is<float>())     thresholds.temp_warn_c     = doc["temp_warn_c"];
  if (doc["temp_crit_c"].is<float>())     thresholds.temp_crit_c     = doc["temp_crit_c"];
  if (doc["temp_low_crit_c"].is<float>()) thresholds.temp_low_crit_c = doc["temp_low_crit_c"];
  if (doc["water_wet_crit"].is<int>())    thresholds.water_wet_crit  = doc["water_wet_crit"];
  if (doc["current_max_a"].is<float>())   thresholds.current_max_a   = doc["current_max_a"];
  if (doc["sms_recipients"].is<const char*>()) {
    snprintf(gSmsRecipients, sizeof(gSmsRecipients), "%s", (const char*)doc["sms_recipients"]);
  }
  logMsg("MQTT", "threshold config updated from cloud");
}

static bool mqttEnsureConnected() {
  if (!wifiConnected) return false;
  if (mqtt.connected()) { mqttConnected = true; return true; }

  unsigned long now = millis();
  if (now - lastMqttRetryMs < backoffMs) return false;
  lastMqttRetryMs = now;

#if MQTT_USE_TLS
  tlsClient.setInsecure();   // hackathon: skip cert validation; pin CA in prod
#endif
  String clientId = String("coldguard-") + DEVICE_ID;
  // LWT: broker marks device offline if we drop ungracefully.
  bool ok;
  if (strlen(MQTT_USER) > 0)
    ok = mqtt.connect(clientId.c_str(), MQTT_USER, MQTT_PASS,
                      topicStatus().c_str(), 0, true, "{\"online\":false}");
  else
    ok = mqtt.connect(clientId.c_str(),
                      topicStatus().c_str(), 0, true, "{\"online\":false}");

  if (ok) {
    mqttConnected = true;
    backoffMs = RECONNECT_MIN_MS;
    mqtt.subscribe(topicConfig().c_str());
    logMsg("MQTT", "connected; subscribed to config topic");
  } else {
    logMsg("MQTT", String("connect failed rc=") + mqtt.state());
    backoffMs = min(backoffMs * 2, RECONNECT_MAX_MS);
  }
  return mqttConnected;
}

/* ================================================================== */
/* Offline buffer - LittleFS append-only log of JSON lines (FR-14)      */
/* ================================================================== */
static size_t bufferCount() {
  File f = LittleFS.open(BUFFER_FILE, "r");
  if (!f) return 0;
  size_t n = 0;
  while (f.available()) { f.readStringUntil('\n'); n++; }
  f.close();
  return n;
}

/* Keep only the newest (maxKeep-1) lines so the file stays bounded. */
static void bufferTrim(size_t maxKeep) {
  File f = LittleFS.open(BUFFER_FILE, "r");
  if (!f) return;
  // First pass: count lines.
  size_t total = 0;
  while (f.available()) { f.readStringUntil('\n'); total++; }
  if (total < maxKeep) { f.close(); return; }
  if (total > 4096) {                                // sanity: never blow the heap
    f.close();
    LittleFS.remove(BUFFER_FILE);
    logMsg("BUF", "buffer file oversized - reset");
    return;
  }

  // Second pass: keep the tail (re-open; File::seek is not portable).
  f.close();
  f = LittleFS.open(BUFFER_FILE, "r");
  if (!f) return;
  String* all = new String[total];
  size_t n = 0;
  while (f.available() && n < total) {
    String line = f.readStringUntil('\n');
    line.trim();
    if (line.length()) all[n++] = line;
  }
  f.close();

  File w = LittleFS.open(BUFFER_FILE, "w");
  for (size_t i = (n > maxKeep ? n - maxKeep : 0); i < n; i++) w.println(all[i]);
  w.close();
  delete[] all;
}

static bool bufferAppend(const String& jsonLine) {
  if (bufferCount() >= BUFFER_MAX_ENTRIES) bufferTrim(BUFFER_MAX_ENTRIES - 1);
  File f = LittleFS.open(BUFFER_FILE, FILE_APPEND);
  if (!f) { logMsg("BUF", "open for append failed"); return false; }
  f.println(jsonLine);
  f.close();
  return true;
}

/* Replay buffered readings oldest->newest (chronological, FR-14).
 * On partial failure, rewrites the unsent tail back to the file. */
static void bufferReplay() {
  size_t n = bufferCount();
  if (n == 0) { LittleFS.remove(BUFFER_FILE); return; }
  File f = LittleFS.open(BUFFER_FILE, "r");
  if (!f) return;

  String* lines = new String[n];
  size_t got = 0;
  while (f.available() && got < n) {
    String line = f.readStringUntil('\n');
    line.trim();
    if (line.length()) lines[got++] = line;
  }
  f.close();

  size_t sent = 0;
  for (size_t i = 0; i < got; i++) {
    if (!mqtt.publish(topicTelemetry().c_str(), lines[i].c_str(), 1, false)) break; // QoS1
    sent++;
    delay(20);
  }

  if (sent >= got) {
    LittleFS.remove(BUFFER_FILE);
    logMsg("BUF", String("replayed ") + sent + " buffered readings; buffer cleared");
  } else {
    File w = LittleFS.open(BUFFER_FILE, "w");
    for (size_t i = sent; i < got; i++) w.println(lines[i]);
    w.close();
    logMsg("BUF", String("replayed ") + sent + "/" + got + "; link dropped, rest kept");
  }
  delete[] lines;
}

static void bufferInit() {
  if (!LittleFS.begin(true)) {                    // formatOnFail
    logMsg("BUF", "LittleFS mount failed - offline buffering disabled");
    return;
  }
  logMsg("BUF", String("LittleFS ok; buffered readings=") + bufferCount());
}

/* ================================================================== */
/* Sensor acquisition                                                   */
/* ================================================================== */
struct Reading {
  float tempC = NAN, humidity = NAN;
  float currentA = NAN;
  int   waterRaw = 0, waterWet = 0;
  const char* quality = "ok";                    // FR-13 flag string
};

static bool plausibleTemp(float t) { return t >= TEMP_PLAUSIBLE_MIN_C && t <= TEMP_PLAUSIBLE_MAX_C; }
static bool plausibleHumi(float h) { return h >= HUMID_PLAUSIBLE_MIN  && h <= HUMID_PLAUSIBLE_MAX; }
static bool plausibleCurr(float a) { return a >= -0.5f && a <= CURRENT_PLAUSIBLE_MAX_A; }

static void setQuality(Reading& r, const char* q) {
  // Keep the first (most severe) flag; "ok" may be overwritten.
  if (r.quality == nullptr || strcmp(r.quality, "ok") == 0) r.quality = q;
}

static void readSensors(Reading& r) {
  /* --- DHT11: temp + humidity; one retry on NaN (DHTs are flaky) --- */
  float t = dht.readTemperature();
  float h = dht.readHumidity();
  if (isnan(t) || isnan(h)) {
    delay(1500);
    t = dht.readTemperature();
    h = dht.readHumidity();
    if (isnan(t) || isnan(h)) { t = NAN; h = NAN; setQuality(r, "dht_nan"); }
  }
  r.tempC = t; r.humidity = h;
  if (!isnan(t) && !plausibleTemp(t)) setQuality(r, "temp_implausible");
  if (!isnan(h) && !plausibleHumi(h)) setQuality(r, "humidity_implausible");

  /* --- Water sensor (AO, GPIO34) --- */
  r.waterRaw = constrain(analogRead(PIN_WATER_AO), 0, WATER_LEVEL_MAX);
  // Wet per WATER_WET_THRESHOLD; WATER_WET_INVERT flips the comparison for
  // modules whose dry state is HIGH instead of LOW.
#if WATER_WET_INVERT
  r.waterWet = (r.waterRaw <= WATER_WET_THRESHOLD) ? 1 : 0;
#else
  r.waterWet = (r.waterRaw >= WATER_WET_THRESHOLD) ? 1 : 0;
#endif

  /* --- ACS712 current (GPIO36) --- */
  long sum = 0;
  const int ACS_SAMPLES = 16;
  for (int i = 0; i < ACS_SAMPLES; i++) { sum += analogRead(PIN_ACS712_OUT); delay(2); }
  float rawAvg = (float)sum / ACS_SAMPLES;
  float pinMv  = rawAvg * (ACS712_ADC_VREF_MV / ACS712_ADC_MAX) * ACS712_DIVIDER_GAIN;
  float amps   = (pinMv - acs712ZeroMv) / ACS712_SENSITIVITY_MV_PER_A;
  if (plausibleCurr(amps)) {
    r.currentA = amps;
  } else {
    setQuality(r, "current_implausible");
  }

}

/* Boot-time ACS712 zero-current calibration. Run with NO load connected
 * (compressor off) for best results. */
static void calibrateAcs712() {
#if ACS712_FIXED_ZERO
  acs712ZeroMv = ACS712_ZERO_RAW * (ACS712_ADC_VREF_MV / ACS712_ADC_MAX) * ACS712_DIVIDER_GAIN;
#else
  long sum = 0;
  const int N = 64;
  for (int i = 0; i < N; i++) { sum += analogRead(PIN_ACS712_OUT); delay(3); }
  float rawAvg = (float)sum / N;
  acs712ZeroMv = rawAvg * (ACS712_ADC_VREF_MV / ACS712_ADC_MAX) * ACS712_DIVIDER_GAIN;
#endif
  acs712Calibrated = true;
  logMsg("CAL", String("ACS712 zero = ") + String(acs712ZeroMv, 1) + " mV at pin");
}

/* ================================================================== */
/* Telemetry JSON - field names MUST match SRS §7 exactly               */
/* Non-finite floats serialize as JSON null (ArduinoJson behaviour),    */
/* and "quality" carries the FR-13 plausibility flag.                  */
/* ================================================================== */
static void buildTelemetryJson(const Reading& r, JsonDocument& doc) {
  doc["device_id"]          = DEVICE_ID;
  doc["timestamp"]          = iso8601utc();
  doc["temperature_c"]      = r.tempC;
  doc["humidity_percent"]   = r.humidity;
  doc["current_a"]          = r.currentA;
  doc["water_level"]        = r.waterRaw;
  doc["water_wet"]          = (r.waterWet == 1);
  doc["firmware_version"]   = FIRMWARE_VERSION;
  doc["quality"]            = r.quality ? r.quality : "ok";
}

/* Publish QoS1 now if possible; otherwise append to the offline buffer. */
static void publishOrBuffer(const String& json) {
  if (mqttEnsureConnected() && mqtt.publish(topicTelemetry().c_str(), json.c_str(), 1, false)) {
    logMsg("MQTT", "telemetry published");
  } else {
    bufferAppend(json);
    logMsg("BUF", "link down - reading buffered");
  }
}

static void publishStatus(bool online) {
  if (!mqttEnsureConnected()) return;
  JsonDocument doc;
  doc["device_id"]        = DEVICE_ID;
  doc["online"]           = online;
  doc["firmware_version"] = FIRMWARE_VERSION;
  doc["last_seen"]        = iso8601utc();
  char buf[192];
  size_t n = serializeJson(doc, buf, sizeof(buf));
  if (n > 0) mqtt.publish(topicStatus().c_str(), buf, true);   // retained
}

/* ================================================================== */
/* SIM800L / GSM SMS (FR-14a / FR-14b)                                  */
/* ================================================================== */
#if ENABLE_SMS
static HardwareSerial simSerial(2);   // UART2

/* Wait for `expect` substring in the RX stream WITHOUT flushing first.
 * Used both after commands and after the SMS body + Ctrl-Z. */
static bool simWaitFor(const char* expect, unsigned long timeoutMs, String* resp = nullptr) {
  unsigned long start = millis();
  String out;
  while (millis() - start < timeoutMs) {
    while (simSerial.available()) {
      char c = (char)simSerial.read();
      out += c;
      if (expect && strstr(out.c_str(), expect)) {
        if (resp) *resp = out;
        return true;
      }
    }
  }
  if (resp) *resp = out;
  return false;
}

/* Send an AT command: flush stale RX, send cmd+CR, wait for expect/timeout. */
static bool simSendAT(const String& cmd, const char* expect, unsigned long timeoutMs,
                      String* resp = nullptr) {
  while (simSerial.available()) simSerial.read();
  if (cmd.length()) { simSerial.print(cmd); simSerial.print("\r"); }
  return simWaitFor(expect, timeoutMs, resp);
}

static bool simInit() {
  simSerial.begin(SIM800L_BAUD, SERIAL_8N1, PIN_SIM800L_RX, PIN_SIM800L_TX);
  delay(3000);                                            // module power-up

  String r;
  if (!simSendAT("AT", "OK", SIM_CMD_TIMEOUT_MS, &r)) {
    logMsg("SIM", "no AT response - check wiring/power/baud");
    return false;
  }
  simSendAT("ATE0", "OK", SIM_CMD_TIMEOUT_MS);            // echo off
  simSendAT("AT+CMGF=1", "OK", SIM_CMD_TIMEOUT_MS);       // text-mode SMS
  simSendAT("AT+CSCS=\"GSM\"", "OK", SIM_CMD_TIMEOUT_MS); // 7-bit GSM alphabet
  simSendAT("AT+CNMI=2,1,0,0,0", "OK", SIM_CMD_TIMEOUT_MS);

  simSendAT("AT+CSQ", "OK", SIM_CMD_TIMEOUT_MS, &r);
  logMsg("SIM", String("CSQ: ") + r.substring(0, min((int)r.length(), 60)));
  simSendAT("AT+CREG?", "OK", SIM_CMD_TIMEOUT_MS, &r);
  logMsg("SIM", String("CREG: ") + r.substring(0, min((int)r.length(), 60)));
  return true;
}

/* Send one SMS to one number (CMGS text mode). */
static bool simSendSms(const String& number, const String& text) {
  // Flush, issue CMGS, wait for '>' prompt.
  while (simSerial.available()) simSerial.read();
  simSerial.print("AT+CMGS=\"");
  simSerial.print(number);
  simSerial.print("\"\r");
  if (!simWaitFor(">", SIM_CMD_TIMEOUT_MS)) {
    logMsg("SIM", String("CMGS no '>' prompt for ") + number);
    return false;
  }
  // Body + Ctrl-Z (0x1A) terminator, then wait for +CMGS/OK or ERROR.
  simSerial.print(text);
  simSerial.print("\r\n");          // CMGS bodies are CRLF-terminated on send
  simSerial.write(0x1A);
  String resp;
  if (simWaitFor("OK", 10000, &resp)) {
    logMsg("SIM", String("SMS sent to ") + number);
    return true;
  }
  logMsg("SIM", String("SMS failed to ") + number + ": " + resp.substring(0, min((int)resp.length(), 60)));
  return false;
}

/* Broadcast to every recipient in the configured comma-separated list. */
static void simSendSmsAll(const String& text) {
  String numbers = smsRecipientList();
  int start = 0;
  while (start <= (int)numbers.length()) {
    int comma = numbers.indexOf(',', start);
    String num = (comma == -1) ? numbers.substring(start) : numbers.substring(start, comma);
    num.trim();
    if (num.length() > 0) simSendSms(num, text);
    if (comma == -1) break;
    start = comma + 1;
  }
}
#endif // ENABLE_SMS

/* ================================================================== */
/* Critical-alert evaluation + SMS dispatch (FR-14a/FR-14b)            */
/* ================================================================== */
static const char* alertName(AlertKind k) {
  switch (k) {
    case ALERT_TEMP_HIGH: return "temperature_high";
    case ALERT_TEMP_LOW:  return "temperature_low";
    case ALERT_WATER:     return "water_leak";
    case ALERT_CURRENT:   return "overcurrent";
    default:              return "unknown";
  }
}

/* FR-14a: SMS is the OFFLINE path - only when MQTT (cloud path) is down.
 * FR-14b: rate-limited to one SMS per alert kind per cooldown. */
static void evaluateCriticalAlerts(const Reading& r) {
#if ENABLE_SMS
  if (!sim_enabled || mqttConnected) return;

  struct Check { AlertKind kind; bool fire; String value; };
  Check checks[] = {
    { ALERT_TEMP_HIGH, !isnan(r.tempC) && r.tempC >= thresholds.temp_crit_c,
      String(r.tempC, 1) + "C" },
    { ALERT_TEMP_LOW,  !isnan(r.tempC) && r.tempC <= thresholds.temp_low_crit_c,
      String(r.tempC, 1) + "C" },
    { ALERT_WATER,     thresholds.water_wet_crit != 0 && r.waterWet == 1,
      String(r.waterRaw) },
    { ALERT_CURRENT,   thresholds.current_max_a > 0.0f && !isnan(r.currentA) &&
                       r.currentA >= thresholds.current_max_a,
      String(r.currentA, 2) + "A" },
  };

  for (size_t i = 0; i < sizeof(checks)/sizeof(checks[0]); i++) {
    if (!checks[i].fire) continue;
    unsigned long now = millis();
    if (now - lastSmsMs[checks[i].kind] < SIM_SMS_COOLDOWN_MS) continue;

    String msg = String("ColdGuard CRITICAL: ") + ASSET_LABEL + " " +
                 alertName(checks[i].kind) + "=" + checks[i].value +
                 " at " + iso8601utc();
    logMsg("ALERT", msg);
    simSendSmsAll(msg);
    lastSmsMs[checks[i].kind] = now;      // stamp even if send failed (anti-spam)
  }
#endif
}

/* ================================================================== */
/* Setup / loop                                                        */
/* ================================================================== */
void setup() {
  Serial.begin(115200);
  delay(500);
  logMsg("BOOT", String("ColdGuard v") + FIRMWARE_VERSION + " device=" + DEVICE_ID);

  pinMode(PIN_WATER_AO, INPUT);
  pinMode(PIN_ACS712_OUT, INPUT);

  dht.begin();

  mqtt.setCallback(mqttCallback);   // for coldguard/device/{id}/config pushes
  mqtt.setBufferSize(MQTT_BUFFER_SIZE);

  calibrateAcs712();
  bufferInit();

  WiFi.mode(WIFI_STA);
  WiFi.setAutoReconnect(true);

#if ENABLE_SMS
  sim_enabled = true;
  sim_ready   = simInit();
  sim_enabled = sim_ready;
  if (!sim_ready) logMsg("SIM", "init failed - periodic retry enabled");
#else
  sim_enabled = false;
  logMsg("SIM", "disabled at compile time (ENABLE_SMS=0)");
#endif
}

void loop() {
  unsigned long now = millis();

  /* --- Link maintenance --- */
  wifiEnsureConnected();
  bool wasMqtt = mqttConnected;
  mqttEnsureConnected();
  if (mqttConnected) {
    mqtt.loop();
    if (!wasMqtt) {                        // fresh MQTT session: drain buffer
      bufferReplay();
      publishStatus(true);
    }
  }

  /* --- Status heartbeat every ~30s --- */
  if (mqttConnected && now - lastStatusMs >= STATUS_INTERVAL_MS) {
    lastStatusMs = now;
    publishStatus(true);
  }

  /* --- Sampling every SAMPLE_INTERVAL_MS (default 60s) --- */
  if (now - lastSampleMs >= SAMPLE_INTERVAL_MS) {
    lastSampleMs = now;

    Reading r;
    readSensors(r);

    Serial.printf("[SENS] t=%.1f h=%.1f I=%.2f water=%d wet=%d q=%s\n",
                  r.tempC, r.humidity,
                  r.currentA, r.waterRaw, r.waterWet,
                  r.quality ? r.quality : "ok");

    JsonDocument doc;                       // ArduinoJson 7: auto-sized
    buildTelemetryJson(r, doc);
    char payload[1024];
    size_t len = serializeJson(doc, payload, sizeof(payload));
    if (len > 0 && len < sizeof(payload)) {
      publishOrBuffer(String(payload, len));
    } else {
      logMsg("BUF", "JSON serialize overflow - reading dropped");
    }
    evaluateCriticalAlerts(r);
  }

  /* --- SIM retry if init failed (runs even with Wi-Fi down) --- */
#if ENABLE_SMS
  if (sim_enabled && !sim_ready && now - simLastRetryMs > 60000) {
    simLastRetryMs = now;
    sim_ready   = simInit();
    sim_enabled = sim_ready;
    logMsg("SIM", sim_ready ? "retry succeeded" : "retry failed");
  }
#endif

  delay(10);                                // bounded waits only; keep loop light
}
