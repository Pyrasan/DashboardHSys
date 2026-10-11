#include <ESP8266WiFi.h>
#include <PubSubClient.h>

const char* WIFI_SSID = "your_wifi_ssid";
const char* WIFI_PASS = "your_wifi_password";

const char* MQTT_BROKER = "192.168.1.100";
const int MQTT_PORT = 1883;
const char* MQTT_TOPIC_COMMAND = "gate/command";
const char* MQTT_TOPIC_STATUS = "gate/status";

const int LED_PIN = 2;

WiFiClient wifiClient;
PubSubClient mqtt(wifiClient);

unsigned long openStartTime = 0;
bool gateOpen = false;
bool openingAnim = false;
unsigned long lastAnimToggle = 0;
int animState = 0;

void setup() {
  Serial.begin(115200);
  pinMode(LED_PIN, OUTPUT);
  digitalWrite(LED_PIN, LOW);

  connectWiFi();
  mqtt.setServer(MQTT_BROKER, MQTT_PORT);
  mqtt.setCallback(callback);
  connectMQTT();
}

void loop() {
  if (!mqtt.connected()) connectMQTT();
  mqtt.loop();

  if (openingAnim) {
    unsigned long now = millis();
    if (now - lastAnimToggle > 150) {
      lastAnimToggle = now;
      digitalWrite(LED_PIN, animState % 2 == 0 ? HIGH : LOW);
      animState++;
      if (animState >= 14) {
        openingAnim = false;
        gateOpen = true;
        openStartTime = millis();
        digitalWrite(LED_PIN, HIGH);
        publishStatus("OPEN");
        Serial.println("[GATE] OPEN");
      }
    }
  }

  if (gateOpen && millis() - openStartTime > 5000) {
    gateOpen = false;
    digitalWrite(LED_PIN, LOW);
    publishStatus("CLOSED");
    Serial.println("[GATE] CLOSED");
  }
}

void connectWiFi() {
  Serial.print("[WIFI] Connecting");
  WiFi.begin(WIFI_SSID, WIFI_PASS);
  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
  }
  Serial.println(" CONNECTED");
  Serial.printf("[WIFI] IP: %s\n", WiFi.localIP().toString().c_str());
}

void connectMQTT() {
  while (!mqtt.connected()) {
    Serial.print("[MQTT] Connecting");
    if (mqtt.connect("ESP8266_Gate")) {
      Serial.println(" CONNECTED");
      mqtt.subscribe(MQTT_TOPIC_COMMAND);
      Serial.printf("[MQTT] Subscribed to %s\n", MQTT_TOPIC_COMMAND);
    } else {
      Serial.print(".");
      delay(2000);
    }
  }
}

void callback(char* topic, byte* payload, unsigned int length) {
  payload[length] = '\0';
  String msg = String((char*)payload);
  Serial.printf("[MQTT] %s: %s\n", topic, msg.c_str());

  if (String(topic) == MQTT_TOPIC_COMMAND) {
    if (msg.indexOf("OPEN") >= 0 && !openingAnim && !gateOpen) {
      Serial.println("[GATE] Opening...");
      openingAnim = true;
      animState = 0;
      publishStatus("OPENING");
    }
  }
}

void publishStatus(const char* status) {
  if (!mqtt.connected()) return;
  String payload = "{\"gate\":\"ESP8266_GATE\",\"status\":\"";
  payload += status;
  payload += "\"}";
  mqtt.publish(MQTT_TOPIC_STATUS, payload.c_str());
}
