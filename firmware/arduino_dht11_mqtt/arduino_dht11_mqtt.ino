/*
  ColdGuard — Arduino IDE sketch (DHT11 → MQTT → dashboard)

  Flash once from Arduino IDE. The ESP32 runs by itself after that.
  You still need Mosquitto + backend (+ web) running on the PC.

  Libraries (Sketch → Include Library → Manage Libraries):
  - DHT sensor library (Adafruit)
  - Adafruit Unified Sensor
  - PubSubClient
  - ArduinoJson (v7)

  Board: ESP32S3 Dev Module (or your ESP32 board)
  Serial: 115200
*/

#include <WiFi.h>
#include <PubSubClient.h>
#include <ArduinoJson.h>
#include <DHT.h>

#define DHTPIN 4
#define DHTTYPE DHT11

const char* WIFI_SSID = "Phoenix";
const char* WIFI_PASS = "Crypto.com";
const char* MQTT_HOST = "192.168.100.5";  // this PC — not the router (.1)
const uint16_t MQTT_PORT = 1883;
const char* DEVICE_ID = "CG-001";

const unsigned long SAMPLE_MS = 5000;  // publish every 5s

DHT dht(DHTPIN, DHTTYPE);
WiFiClient wifiClient;
PubSubClient mqtt(wifiClient);

String telemetryTopic() {
  return String("coldguard/device/") + DEVICE_ID + "/telemetry";
}

void connectWifi() {
  if (WiFi.status() == WL_CONNECTED) return;
  WiFi.mode(WIFI_STA);
  WiFi.begin(WIFI_SSID, WIFI_PASS);
  Serial.print("WiFi");
  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
  }
  Serial.println();
  Serial.print("IP: ");
  Serial.println(WiFi.localIP());
}

void connectMqtt() {
  while (!mqtt.connected()) {
    Serial.print("MQTT...");
    if (mqtt.connect(DEVICE_ID)) {
      Serial.println("ok");
    } else {
      Serial.print("fail rc=");
      Serial.println(mqtt.state());
      delay(2000);
    }
  }
}

void setup() {
  Serial.begin(115200);
  delay(500);
  dht.begin();
  mqtt.setServer(MQTT_HOST, MQTT_PORT);
  connectWifi();
  connectMqtt();
}

void loop() {
  connectWifi();
  if (!mqtt.connected()) connectMqtt();
  mqtt.loop();

  float h = dht.readHumidity();
  float t = dht.readTemperature();
  if (isnan(h) || isnan(t)) {
    Serial.println("DHT11 read failed");
    delay(SAMPLE_MS);
    return;
  }

  JsonDocument doc;
  doc["device_id"] = DEVICE_ID;
  doc["temperature_c"] = t;
  doc["humidity_percent"] = h;
  doc["firmware_version"] = "0.1.0-arduino";

  char buffer[256];
  size_t n = serializeJson(doc, buffer);
  bool ok = mqtt.publish(telemetryTopic().c_str(), (uint8_t*)buffer, n);
  Serial.print(ok ? "Published: " : "Publish failed: ");
  Serial.println(buffer);

  delay(SAMPLE_MS);
}
