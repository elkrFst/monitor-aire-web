const test = require("node:test");
const assert = require("node:assert/strict");
const webhook = require("../particle-webhook.json");
const {
  buildDashboardReadings,
  decodeReadingUpdate
} = require("../reading-schema");

test("Particle webhook template produces the API event envelope", () => {
  const readings = { temperature1: 22.5, humidity1: 48, mq6: 1200 };
  const body = webhook.body
    .replace("{{{PARTICLE_EVENT_NAME}}}", "photon-readings")
    .replace("{{{PARTICLE_EVENT_VALUE}}}", JSON.stringify(readings));

  assert.deepEqual(JSON.parse(body), {
    event: "photon-readings",
    data: readings
  });
});

test("decodes a Particle webhook event as a Photon update", () => {
  const update = decodeReadingUpdate({
    event: "photon-readings",
    data: JSON.stringify({ temperature1: 22.5, humidity1: 48, mq6: 1200 })
  });

  assert.deepEqual(update, {
    source: "photon",
    readings: { temperature1: 22.5, humidity1: 48, mq6: 1200 }
  });
});

test("rejects readings outside the sensor range", () => {
  const update = decodeReadingUpdate({
    source: "photon",
    temperature1: 22,
    humidity1: 45,
    mq6: 4096
  });

  assert.match(update.error, /fuera del rango/);
});

test("merges fresh module readings and independently clears stale modules", () => {
  const now = 100000;
  const dashboard = buildDashboardReadings({
    photon: {
      readings: { temperature1: 22, humidity1: 45, mq6: 1000 },
      updatedAt: new Date(now - 100000).toISOString(),
      receivedAt: now - 100000
    },
    esp8266: {
      readings: { temperature2: 24, humidity2: 50, mq2: 300 },
      updatedAt: new Date(now - 5000).toISOString(),
      receivedAt: now - 5000
    }
  }, now);

  assert.equal(dashboard.temperature1, null);
  assert.equal(dashboard.mq6, null);
  assert.equal(dashboard.temperature2, 24);
  assert.equal(dashboard.mq2, 300);
  assert.equal(dashboard.stale, false);
  assert.equal(dashboard.modules.photon.stale, true);
  assert.equal(dashboard.modules.esp8266.stale, false);
});
