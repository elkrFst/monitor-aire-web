#include <ESP8266WiFi.h>
#include <ESP8266HTTPClient.h>
#include <WiFiClientSecure.h>
#include <SoftwareSerial.h>
#include <DHT.h>

const char* WIFI_SSID = "Practicas";
const char* WIFI_PASSWORD = "ucolfie26";
const char* SERVER_URL = "https://monitordeaire.site/api/readings";

#define DHT_PIN D1
#define DHT_TYPE DHT11
#define MQ2_PIN A0
#define PHOTON_RX_PIN D5
#define PHOTON_UNUSED_TX_PIN D6

const unsigned long READ_INTERVAL_MS = 3000;
const unsigned long POST_INTERVAL_MS = 5000;

DHT dht(DHT_PIN, DHT_TYPE);
SoftwareSerial photonSerial(PHOTON_RX_PIN, PHOTON_UNUSED_TX_PIN);
float temperature1 = NAN;
float humidity1 = NAN;
float mq6Raw = NAN;
float temperature2 = NAN;
float humidity2 = NAN;
float mq2Raw = NAN;
unsigned long lastRead = 0;
unsigned long lastPost = 0;

void readPhotonLine() {
  static char line[64];
  static size_t lineLength = 0;

  while (photonSerial.available()) {
    const char character = static_cast<char>(photonSerial.read());
    if (character == '\r') continue;
    if (character == '\n') {
      line[lineLength] = '\0';
      float newTemperature;
      float newHumidity;
      int newMq6Raw;
      if (sscanf(line, "%f,%f,%d", &newTemperature, &newHumidity, &newMq6Raw) == 3) {
        temperature1 = newTemperature >= 0 ? newTemperature : NAN;
        humidity1 = newHumidity >= 0 ? newHumidity : NAN;
        mq6Raw = newMq6Raw >= 0 && newMq6Raw <= 4095 ? newMq6Raw : NAN;
      } else {
        Serial.println("Se ignoro una linea invalida recibida de la Photon.");
      }
      lineLength = 0;
    } else if (lineLength < sizeof(line) - 1) {
      line[lineLength++] = character;
    } else {
      lineLength = 0;
      Serial.println("Se descarto una linea larga recibida de la Photon.");
    }
  }
}

void formatReading(float value, char* output, size_t outputSize, int decimals) {
  if (!isfinite(value)) {
    snprintf(output, outputSize, "null");
    return;
  }
  snprintf(output, outputSize, decimals == 0 ? "%.0f" : "%.1f", value);
}

void postReadings() {
  if (WiFi.status() != WL_CONNECTED) {
    Serial.println("Wi-Fi desconectado; se omitio el envio.");
    return;
  }

  char t1[16], h1[16], mq6[16], t2[16], h2[16], mq2[16], payload[192];
  formatReading(temperature1, t1, sizeof(t1), 1);
  formatReading(humidity1, h1, sizeof(h1), 1);
  formatReading(mq6Raw, mq6, sizeof(mq6), 0);
  formatReading(temperature2, t2, sizeof(t2), 1);
  formatReading(humidity2, h2, sizeof(h2), 1);
  formatReading(mq2Raw, mq2, sizeof(mq2), 0);

  snprintf(
    payload,
    sizeof(payload),
    "{\"temperature1\":%s,\"humidity1\":%s,\"mq6\":%s,"
    "\"temperature2\":%s,\"humidity2\":%s,\"mq2\":%s}",
    t1, h1, mq6, t2, h2, mq2
  );

  BearSSL::WiFiClientSecure client;
  client.setInsecure();
  HTTPClient http;
  if (!http.begin(client, SERVER_URL)) {
    Serial.println("No se pudo iniciar la conexion HTTP al servidor.");
    return;
  }
  http.addHeader("Content-Type", "application/json");
  const int statusCode = http.POST(payload);
  if (statusCode > 0) {
    Serial.printf("Lecturas enviadas. HTTP %d\n", statusCode);
  } else {
    Serial.printf("Error al enviar lecturas: %s\n", http.errorToString(statusCode).c_str());
  }
  http.end();
}

void setup() {
  Serial.begin(115200);
  photonSerial.begin(9600);
  dht.begin();
  WiFi.mode(WIFI_STA);
  WiFi.setAutoReconnect(true);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);

  Serial.print("Conectando a Wi-Fi");
  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print('.');
  }
  Serial.println();
  Serial.print("ESP8266 conectado; IP: ");
  Serial.println(WiFi.localIP());
}

void loop() {
  readPhotonLine();
  const unsigned long now = millis();

  if (now - lastRead >= READ_INTERVAL_MS) {
    lastRead = now;
    float measuredTemperature = dht.readTemperature();
    float measuredHumidity = dht.readHumidity();
    temperature2 = isnan(measuredTemperature) ? NAN : measuredTemperature;
    humidity2 = isnan(measuredHumidity) ? NAN : measuredHumidity;
    mq2Raw = analogRead(MQ2_PIN);
    if (isnan(measuredTemperature) || isnan(measuredHumidity)) {
      Serial.println("DHT11 del modulo 2 no respondio. Revise DATA, GND y VCC.");
    }
  }

  if (now - lastPost >= POST_INTERVAL_MS) {
    lastPost = now;
    postReadings();
  }
}
