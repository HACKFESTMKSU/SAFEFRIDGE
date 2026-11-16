/*
  ColdGuard — DHT11 + water level + buzzer alert → MQTT → dashboard

  Libraries: DHT sensor library (Adafruit), Adafruit Unified Sensor,
             PubSubClient, ArduinoJson (v7)
  Board: ESP32S3 Dev Module | Serial: 115200

  Note: DHT11 often returns NaN when blasted with hot/humid air.
  We keep the last good reading and still publish so the dashboard
  never drops to a fake 0°C.
*/

#include <WiFi.h>
#include <PubSubClient.h>
#include <ArduinoJson.h>
#include <DHT.h>

#define DHTPIN 4
#define DHTTYPE DHT11

// Water level sensor (HW-038)
#define WATER_PIN 6
#define WATER_PWR 7
#define WATER_DRY_RAW 0      // calibrate: reading when dry
#define WATER_WET_RAW 2500   // calibrate: reading when submerged

// Buzzer (active type)
#define BUZZER_PIN 8
#define BUZ_ON_MS 300
#define BUZ_OFF_MS 200

// Local buzzer thresholds (dashboard uses its own Thresholds page)
#define TEMP_ALERT_C 30.0
#define HUM_ALERT_PERCENT 80.0
#define WATER_ALERT_PERCENT 30
#define WATER_WET_PERCENT 25

const char* WIFI_SSID = "Phoenix";
const char* WIFI_PASS = "Crypto.com";
const char* MQTT_HOST = "192.168.100.5";
const uint16_t MQTT_PORT = 1883;
const char* DEVICE_ID = "CG-001";

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
    Serial.println(WiFi.localIP());
  }
  if (!mqtt.connected() && millis() - lastMqttTryMs > 3000) {
    lastMqttTryMs = millis();
    Serial.print("MQTT...");
    if (mqtt.connect(DEVICE_ID)) {
      Serial.println("ok");
    } else {
      Serial.print("fail rc=");
      Serial.println(mqtt.state());
    }
  }
}

int readWaterRaw() {
  digitalWrite(WATER_PWR, HIGH);
  delay(10);
  long sum = 0;
  for (int i = 0; i < 5; i++) {
    sum += analogRead(WATER_PIN);
    delay(2);
  }
  digitalWrite(WATER_PWR, LOW);
  return sum / 5;
}

int waterPercent(int raw) {
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
  doc["firmware_version"] = "0.5.0-arduino";

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
  pinMode(WATER_PWR, OUTPUT);
  digitalWrite(WATER_PWR, LOW);
  analogSetPinAttenuation(WATER_PIN, ADC_11db);

  WiFi.mode(WIFI_STA);
  WiFi.begin(WIFI_SSID, WIFI_PASS);
  mqtt.setServer(MQTT_HOST, MQTT_PORT);
  mqtt.setBufferSize(512);

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
