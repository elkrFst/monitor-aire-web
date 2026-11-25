const MODULE_FIELDS = {
  photon: ["temperature1", "humidity1", "mq6"],
  esp8266: ["temperature2", "humidity2", "mq2"]
};
const MODULE_STALE_TIMEOUTS = {
  photon: 90000,
  esp8266: 15000
};
const PHOTON_EVENT_NAME = "photon-readings";

function decodeReadingUpdate(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return { error: "Se esperaba un objeto JSON." };
  }

  let payload = value;
  if (value.event !== undefined) {
    if (value.event !== PHOTON_EVENT_NAME) {
      return { error: "Evento Particle no reconocido." };
    }

    let data = value.data;
    if (typeof data === "string") {
      try {
        data = JSON.parse(data);
      } catch {
        return { error: "Los datos del evento Particle no son JSON valido." };
      }
    }
    if (!data || typeof data !== "object" || Array.isArray(data)) {
      return { error: "El evento Particle debe contener un objeto de lecturas." };
    }
    payload = { ...data, source: "photon" };
  }

  const source = payload.source;
  const fields = Object.prototype.hasOwnProperty.call(MODULE_FIELDS, source)
    ? MODULE_FIELDS[source]
    : null;
  if (!fields) {
    return { error: "La fuente debe ser photon o esp8266." };
  }

  const readings = {};
  for (const key of fields) {
    if (!Object.prototype.hasOwnProperty.call(payload, key)) {
      return { error: `Falta la lectura ${key}.` };
    }

    const reading = payload[key];
    if (reading !== null && (typeof reading !== "number" || !Number.isFinite(reading))) {
      return { error: `La lectura ${key} debe ser numerica o null.` };
    }
    if (reading === null) {
      readings[key] = null;
      continue;
    }

    if ((key === "mq6" || key === "mq2") && !Number.isInteger(reading)) {
      return { error: `La lectura ${key} debe ser un entero ADC.` };
    }

    const minimum = key.startsWith("temperature") ? -20 : 0;
    const maximum = key.startsWith("temperature")
      ? 80
      : key.startsWith("humidity")
        ? 100
        : key === "mq6"
          ? 4095
          : 1023;
    if (reading < minimum || reading > maximum) {
      return { error: `La lectura ${key} esta fuera del rango permitido (${minimum} a ${maximum}).` };
    }
    readings[key] = reading;
  }

  return { source, readings };
}

function buildDashboardReadings(records, now = Date.now()) {
  const readings = Object.fromEntries(
    Object.values(MODULE_FIELDS).flat().map(key => [key, null])
  );
  const modules = {};
  const freshRecords = [];

  for (const [source, fields] of Object.entries(MODULE_FIELDS)) {
    const record = records[source];
    const isFresh = Boolean(
      record &&
      Number.isFinite(record.receivedAt) &&
      now - record.receivedAt <= MODULE_STALE_TIMEOUTS[source]
    );
    modules[source] = {
      stale: !isFresh,
      updatedAt: isFresh ? record.updatedAt : null
    };

    if (!isFresh) continue;
    freshRecords.push(record);
    for (const key of fields) {
      readings[key] = record.readings[key];
    }
  }

  const latestRecord = freshRecords.reduce(
    (latest, record) => !latest || record.receivedAt > latest.receivedAt ? record : latest,
    null
  );

  return {
    ...readings,
    updatedAt: latestRecord ? latestRecord.updatedAt : null,
    stale: freshRecords.length === 0,
    modules
  };
}

module.exports = {
  MODULE_FIELDS,
  MODULE_STALE_TIMEOUTS,
  buildDashboardReadings,
  decodeReadingUpdate
};
