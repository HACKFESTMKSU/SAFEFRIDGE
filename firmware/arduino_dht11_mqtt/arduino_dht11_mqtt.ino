/*
  ColdGuard — DHT11 + water level + buzzer alert → MQTT → dashboard

  Libraries: DHT sensor library (Adafruit), Adafruit Unified Sensor,
             PubSubClient, ArduinoJson (v7)
  Board: ESP32S3 Dev Module | Serial: 115200

  Note: DHT11 often returns NaN when blasted with hot/humid air.
  We keep the last good reading and still publish so the dashboard
  never drops to a fake 0°C.

  MQTT: LUBAN WORKSHOP blocks client↔client LAN, so we use a public
  broker. Backend must use the same host (MQTT_HOST=broker.emqx.io).
*/

#include <WiFi.h>
#include <PubSubClient.h>
#include <ArduinoJson.h>
#include <DHT.h>

#define DHTPIN 4
#define DHTTYPE DHT11

// Water sensor wiring (HW-038):
//   HW-038 (-) → ESP32 GND
//   HW-038 (+) → ESP32 3V3   ← prefer 3V3 (stable). GPIO 7 also works if jumpered.
//   HW-038 (S) → ESP32 GPIO 6
// GPIO 7 is still driven HIGH so a (+)→GPIO7 jumper keeps working.
#define WATER_PIN 6
#define WATER_PWR 7
// Dry on your board lands ~3000–3900 (noisy). Wet usually DROPS.
// After a real dip, set WATER_WET_RAW to the Serial water_raw you see.
#define WATER_DRY_RAW  0
#define WATER_WET_RAW 2000
#define WATER_INVERT 1

// Buzzer (active type)
#define BUZZER_PIN 8
#define BUZ_ON_MS 300
#define BUZ_OFF_MS 200

// Local buzzer thresholds (dashboard uses its own Thresholds page)
#define TEMP_ALERT_C 30.0
#define HUM_ALERT_PERCENT 80.0
#define WATER_ALERT_PERCENT 30
#define WATER_WET_PERCENT 25

const char* WIFI_SSID = "LUBAN WORKSHOP";
const char* WIFI_PASS = "M@th3w77";
// Public broker — workshop AP isolates LAN peers (ESP cannot reach PC:1883).
// Backend must subscribe to the same host.
const char* MQTT_HOST = "broker.emqx.io";
const uint16_t MQTT_PORT = 1883;
const char* DEVICE_ID = "CG-001";
const char* MQTT_CLIENT_ID = "coldguard-CG-001-lab";

// Faster publish so the UI can feel near real-time (poll is ~1.5s).
const unsigned long SAMPLE_MS = 1500;

DHT dht(DHTPIN, DHTTYPE);
WiFiClient wifiClient;
PubSubClient mqtt(wifiClient);

bool tempAlert = false, humAlert = false, waterAlert = false;
bool alertActive = false;
bool wifiAnnounced = false;
bool haveDht = false;
float lastTempC = 0;
float lastHumidity = 0;
unsigned long lastSampleMs = 0;
unsigned long lastMqttTryMs = 0;

String telemetryTopic() {
  return String("coldguard/device/") + DEVICE_ID + "/telemetry";
}

void maintainConnections() {
  if (WiFi.status() != WL_CONNECTED) {
    wifiAnnounced = false;
    return;
  }
  if (!wifiAnnounced) {
    wifiAnnounced = true;
    Serial.print("WiFi connected, IP: ");
    Serial.print(WiFi.localIP());
    Serial.print("  GW: ");
    Serial.println(WiFi.gatewayIP());
  }
  if (!mqtt.connected() && millis() - lastMqttTryMs > 3000) {
    lastMqttTryMs = millis();
    Serial.print("MQTT ");
    Serial.print(MQTT_HOST);
    Serial.print("...");
    if (mqtt.connect(MQTT_CLIENT_ID)) {
      Serial.println("ok");
    } else {
      Serial.print("fail rc=");
      Serial.println(mqtt.state());
    }
  }
}

int readWaterRaw() {
  // Keep probe powered while sampling (GPIO7 HIGH). Prefer wiring (+) to 3V3.
  digitalWrite(WATER_PWR, HIGH);
  delay(50);  // HW-038 needs settle time when powered from a GPIO

  int samples[9];
  for (int i = 0; i < 9; i++) {
    samples[i] = analogRead(WATER_PIN);
    delay(3);
  }
  // Median — rejects ADC spikes that made dry look "wet"
  for (int i = 0; i < 8; i++) {
    for (int j = i + 1; j < 9; j++) {
      if (samples[j] < samples[i]) {
        int tmp = samples[i];
        samples[i] = samples[j];
        samples[j] = tmp;
      }
    }
  }
  return samples[4];
}

int waterPercent(int raw) {
  // dryRaw → 0%, wetRaw → 100% (inverted: dry is HIGH ADC on this module)
  int pct = map(raw, WATER_DRY_RAW, WATER_WET_RAW, 0, 100);
  return constrain(pct, 0, 100);
}

void updateBuzzer() {
  if (!alertActive) {
    digitalWrite(BUZZER_PIN, LOW);
    return;
  }
  unsigned long phase = millis() % (BUZ_ON_MS + BUZ_OFF_MS);
  digitalWrite(BUZZER_PIN, phase < BUZ_ON_MS ? HIGH : LOW);
}

void sampleAndPublish() {
  float h = dht.readHumidity();
  float t = dht.readTemperature();
  bool dhtOk = !(isnan(t) || isnan(h));

  if (dhtOk) {
    lastTempC = t;
    lastHumidity = h;
    haveDht = true;
    tempAlert = t > TEMP_ALERT_C;
    humAlert = h > HUM_ALERT_PERCENT;
  } else {
    // Keep last good values + alert state; DHT11 often glitches under steam/hot air.
    Serial.println("DHT11 read failed — publishing last good temp/humidity");
  }

  int waterRaw = readWaterRaw();
  int waterPct = waterPercent(waterRaw);
  waterAlert = waterPct > WATER_ALERT_PERCENT;
  alertActive = tempAlert || humAlert || waterAlert;

  if (alertActive) {
    Serial.print("ALERT:");
    if (tempAlert) Serial.print(" temperature");
    if (humAlert) Serial.print(" humidity");
    if (waterAlert) Serial.print(" water");
    Serial.println();
  }

  JsonDocument doc;
  doc["device_id"] = DEVICE_ID;
  if (haveDht) {
    doc["temperature_c"] = lastTempC;
    doc["humidity_percent"] = lastHumidity;
  }
  doc["water_level"] = waterPct;
  doc["water_level_percent"] = waterPct;
  doc["water_raw"] = waterRaw;
  doc["water_wet"] = waterPct >= WATER_WET_PERCENT;
  doc["dht_ok"] = dhtOk;
  doc["alert"] = alertActive;
  doc["alert_temperature"] = tempAlert;
  doc["alert_humidity"] = humAlert;
  doc["alert_water"] = waterAlert;
  doc["firmware_version"] = "0.5.1-arduino";

  char buffer[448];
  size_t n = serializeJson(doc, buffer);

  if (mqtt.connected()) {
    bool ok = mqtt.publish(telemetryTopic().c_str(), (uint8_t*)buffer, n);
    Serial.print(ok ? "Published: " : "Publish failed: ");
  } else {
    Serial.print("Offline, not sent: ");
  }
  Serial.println(buffer);
}

void setup() {
  Serial.begin(115200);
  delay(500);
  dht.begin();

  pinMode(BUZZER_PIN, OUTPUT);
  digitalWrite(BUZZER_PIN, LOW);
  digitalWrite(BUZZER_PIN, HIGH);
  delay(150);
  digitalWrite(BUZZER_PIN, LOW);

  analogReadResolution(12);
  pinMode(WATER_PIN, INPUT);
  pinMode(WATER_PWR, OUTPUT);
  digitalWrite(WATER_PWR, HIGH);  // leave powered; corrosion OK for short demo
  analogSetPinAttenuation(WATER_PIN, ADC_11db);

  WiFi.mode(WIFI_STA);
  WiFi.begin(WIFI_SSID, WIFI_PASS);
  mqtt.setServer(MQTT_HOST, MQTT_PORT);
  mqtt.setBufferSize(512);
  mqtt.setKeepAlive(30);
  mqtt.setSocketTimeout(10);

  lastSampleMs = millis() - SAMPLE_MS;
}

void loop() {
  maintainConnections();
  if (mqtt.connected()) mqtt.loop();

  if (millis() - lastSampleMs >= SAMPLE_MS) {
    lastSampleMs = millis();
    sampleAndPublish();
  }

  updateBuzzer();
}
