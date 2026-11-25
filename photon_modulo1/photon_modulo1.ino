#include "Particle.h"
#include <Adafruit_DHT.h>

#define DHT_PIN D2
#define DHT_TYPE DHT11
#define MQ6_PIN A0

const unsigned long READ_INTERVAL_MS = 3000;
const unsigned long PUBLISH_INTERVAL_MS = 30000;

DHT dht(DHT_PIN, DHT_TYPE);
unsigned long lastRead = 0;
unsigned long lastPublish = 0;
float temperature = NAN;
float humidity = NAN;
int mq6Raw = 0;

void setup() {
  Serial.begin(9600);
  dht.begin();
}

void publishReadings() {
  char temperatureValue[12];
  char humidityValue[12];
  if (isnan(temperature)) {
    snprintf(temperatureValue, sizeof(temperatureValue), "null");
  } else {
    snprintf(temperatureValue, sizeof(temperatureValue), "%.1f", temperature);
  }
  if (isnan(humidity)) {
    snprintf(humidityValue, sizeof(humidityValue), "null");
  } else {
    snprintf(humidityValue, sizeof(humidityValue), "%.1f", humidity);
  }

  char payload[96];
  snprintf(
    payload,
    sizeof(payload),
    "{\"temperature1\":%s,\"humidity1\":%s,\"mq6\":%d}",
    temperatureValue,
    humidityValue,
    mq6Raw
  );

  if (!Particle.connected()) {
    Serial.println("Particle Cloud desconectado; se omitio el evento.");
    return;
  }
  if (!Particle.publish("photon-readings", payload, PRIVATE)) {
    Serial.println("No se pudo publicar el evento photon-readings.");
    return;
  }
  Serial.printf("Lecturas publicadas en Particle: %s\n", payload);
}

void loop() {
  const unsigned long now = millis();
  if (now - lastRead >= READ_INTERVAL_MS) {
    lastRead = now;
    humidity = dht.getHumidity();
    temperature = dht.getTempCelcius();
    mq6Raw = analogRead(MQ6_PIN);

    Serial.print("Modulo 1 | temperatura: ");
    Serial.print(temperature);
    Serial.print(" C, humedad: ");
    Serial.print(humidity);
    Serial.print(" %, MQ-6 ADC: ");
    Serial.println(mq6Raw);
  }

  if (now - lastPublish >= PUBLISH_INTERVAL_MS) {
    lastPublish = now;
    publishReadings();
  }
}
