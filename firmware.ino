#include "Particle.h"
#include <Adafruit_DHT.h>

#define DHTPIN D2
#define DHTTYPE DHT22
#define MQ135_PIN A0

// Conecta el MQ-135 AO a A0 mediante un divisor que limite la entrada a 3.3 V.
const unsigned long PUBLISH_INTERVAL_MS = 10000;
const int ADC_MAX_VALUE = 4095;
const int MIN_PPM = 400;
const int MAX_PPM = 5000;

DHT dht(DHTPIN, DHTTYPE);
unsigned long lastPublish = 0;
int activeThreshold = 1000;

int setUmbral(String command) {
  if (command.length() == 0 || command.length() > 5) {
    return -1;
  }

  for (size_t i = 0; i < command.length(); i++) {
    const char character = command.charAt(i);
    if (character < '0' || character > '9') {
      return -1;
    }
  }

  const int requestedThreshold = command.toInt();
  if (requestedThreshold < 400 || requestedThreshold > 10000) {
    return -1;
  }

  activeThreshold = requestedThreshold;
  return 1;
}

int readEstimatedPpm() {
  const int adcValue = analogRead(MQ135_PIN);
  return MIN_PPM + ((long)adcValue * (MAX_PPM - MIN_PPM)) / ADC_MAX_VALUE;
}

void setup() {
  Serial.begin(9600);
  analogReadResolution(12);
  dht.begin();
  Particle.function("setUmbral", setUmbral);
}

void loop() {
  const unsigned long now = millis();
  if (now - lastPublish < PUBLISH_INTERVAL_MS) {
    return;
  }
  lastPublish = now;

  const float humidity = dht.getHumidity();
  const float temperature = dht.getTempCelcius();
  if (isnan(temperature) || isnan(humidity)) {
    Serial.println("No se pudo leer el sensor DHT22.");
    return;
  }

  const int estimatedPpm = readEstimatedPpm();
  char payload[96];
  snprintf(
    payload,
    sizeof(payload),
    "{\"temperatura\": %.1f, \"humedad\": %.1f, \"eco2\": %d}",
    temperature,
    humidity,
    estimatedPpm
  );

  if (estimatedPpm >= activeThreshold) {
    Serial.println("La lectura estimada alcanzó el umbral configurado.");
  }

  if (!Particle.publish("calidad_aire", payload, PRIVATE)) {
    Serial.println("No se pudo publicar calidad_aire.");
  }
}
