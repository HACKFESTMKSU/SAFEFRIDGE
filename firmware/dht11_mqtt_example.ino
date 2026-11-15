/*
  ColdGuard — DHT11 → Wi-Fi → MQTT (temperature + humidity)

  Libraries (Arduino Library Manager):
  - DHT sensor library (Adafruit)
  - PubSubClient
  - ArduinoJson

  Publish topic: coldguard/device/CG-001/telemetry
  Broker: your PC's LAN IP running Mosquitto (docker compose in infra/)
*/

#include <WiFi.h>
#include <PubSubClient.h>
#include <ArduinoJson.h>
#include <DHT.h>

#define DHTPIN 4
#define DHTTYPE DHT11

// --- edit these ---
const char* WIFI_SSID = "Phoenix";
const char* WIFI_PASS = "Crypto.com";
const char* MQTT_HOST = "192.168.100.5";  // this PC (enp1s0) — not the router (.1)
const uint16_t MQTT_PORT = 1883;
const char* DEVICE_ID = "CG-001";
// ------------------

DHT dht(DHTPIN, DHTTYPE);
WiFiClient wifiClient;
PubSubClient mqtt(wifiClient);

String telemetryTopic() {
  return String("coldguard/device/") + DEVICE_ID + "/telemetry";
}

void connectWifi() {
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
  dht.begin();
  connectWifi();
  mqtt.setServer(MQTT_HOST, MQTT_PORT);
}

void loop() {
  if (WiFi.status() != WL_CONNECTED) connectWifi();
  if (!mqtt.connected()) connectMqtt();
  mqtt.loop();

  delay(5000);  // DHT11: keep >= 2s between reads

  float h = dht.readHumidity();
  float t = dht.readTemperature();
  if (isnan(h) || isnan(t)) {
    Serial.println("DHT11 read failed");
    return;
  }

  JsonDocument doc;
  doc["device_id"] = DEVICE_ID;
  doc["temperature_c"] = t;
  doc["humidity_percent"] = h;
  doc["firmware_version"] = "0.1.0";

  char buffer[256];
  size_t n = serializeJson(doc, buffer);
  bool ok = mqtt.publish(telemetryTopic().c_str(), buffer, n);
  Serial.print(ok ? "Published: " : "Publish failed: ");
  Serial.println(buffer);
}
