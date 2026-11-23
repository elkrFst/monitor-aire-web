#include "Particle.h"
#include <Adafruit_DHT.h>

#define DHT_PIN D2
#define DHT_TYPE DHT11
#define MQ6_PIN A0

const unsigned long READ_INTERVAL_MS = 3000;

DHT dht(DHT_PIN, DHT_TYPE);
unsigned long lastRead = 0;

void setup() {
  Serial.begin(9600);
  Serial1.begin(9600);
  analogReadResolution(12);
  dht.begin();
}

void loop() {
  const unsigned long now = millis();
  if (now - lastRead < READ_INTERVAL_MS) return;
  lastRead = now;

  const float humidity = dht.getHumidity();
  const float temperature = dht.getTempCelcius();
  const int mq6Raw = analogRead(MQ6_PIN);

  Serial1.print(isnan(temperature) ? -1 : temperature, 1);
  Serial1.print(',');
  Serial1.print(isnan(humidity) ? -1 : humidity, 1);
  Serial1.print(',');
  Serial1.println(mq6Raw);

  Serial.print("Modulo 1 | temperatura: ");
  Serial.print(temperature);
  Serial.print(" C, humedad: ");
  Serial.print(humidity);
  Serial.print(" %, MQ-6 ADC: ");
  Serial.println(mq6Raw);
}
