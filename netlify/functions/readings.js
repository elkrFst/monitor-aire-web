const { getStore } = require("@netlify/blobs");

const STORE_NAME = "sensor-readings";
const READING_TIMEOUT_MS = 15000;
const NETLIFY_SITE_ID = "86f119f5-5dc8-4ea4-a63e-b7c59937e3d1";
const readingKeys = [
  "temperature1",
  "humidity1",
  "mq6",
  "temperature2",
  "humidity2",
  "mq2"
];

function json(body, statusCode = 200) {
  return {
    statusCode,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store"
    },
    body: JSON.stringify(body)
  };
}

function validateReadings(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return "Se esperaba un objeto JSON.";
  }
  for (const key of readingKeys) {
    if (!Object.prototype.hasOwnProperty.call(value, key)) {
      return `Falta la lectura ${key}.`;
    }
    const reading = value[key];
    if (reading !== null && (typeof reading !== "number" || !Number.isFinite(reading))) {
      return `La lectura ${key} debe ser numerica o null.`;
    }
    if (reading === null) continue;
    if ((key === "mq6" || key === "mq2") && !Number.isInteger(reading)) {
      return `La lectura ${key} debe ser un entero ADC.`;
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
      return `La lectura ${key} esta fuera del rango permitido (${minimum} a ${maximum}).`;
    }
  }
  return null;
}

exports.handler = async function handler(event) {
  const token = process.env.NETLIFY_BLOBS_TOKEN;
  if (!token) {
    return json({
      error: "Falta configurar NETLIFY_BLOBS_TOKEN en las variables de entorno del sitio."
    }, 503);
  }

  let store;
  try {
    store = getStore(STORE_NAME, { siteID: NETLIFY_SITE_ID, token });
  } catch (error) {
    console.error("No se pudo abrir Netlify Blobs:", error);
    return json({ error: "No se pudo inicializar Netlify Blobs." }, 503);
  }

  if (event.httpMethod === "POST") {
    let payload;
    try {
      payload = JSON.parse(event.body || "{}");
    } catch {
      return json({ error: "JSON invalido." }, 400);
    }

    const validationError = validateReadings(payload);
    if (validationError) return json({ error: validationError }, 400);

    if (!store) {
      return json({ error: "El almacenamiento de lecturas no esta disponible." }, 503);
    }

    const readings = Object.fromEntries(
      readingKeys.map(key => [key, payload[key]])
    );
    const record = {
      readings,
      updatedAt: new Date().toISOString(),
      receivedAt: Date.now()
    };

    try {
      await store.setJSON("latest", record);
      return json({ ok: true, updatedAt: record.updatedAt });
    } catch (error) {
      console.error("No se pudo guardar la lectura:", error);
      return json({ error: "No se pudo guardar la lectura." }, 503);
    }
  }

  if (event.httpMethod !== "GET") {
    return json({ error: "Metodo no permitido." }, 405);
  }

  if (!store) {
    return json({ error: "El almacenamiento de lecturas no esta disponible." }, 503);
  }

  try {
    const record = await store.get("latest", { type: "json" });
    if (!record) {
      return json({
        temperature1: null,
        humidity1: null,
        mq6: null,
        temperature2: null,
        humidity2: null,
        mq2: null,
        updatedAt: null,
        stale: true
      });
    }

    if (Date.now() - record.receivedAt > READING_TIMEOUT_MS) {
      return json({
        temperature1: null,
        humidity1: null,
        mq6: null,
        temperature2: null,
        humidity2: null,
        mq2: null,
        updatedAt: record.updatedAt,
        stale: true
      });
    }

    return json({ ...record.readings, updatedAt: record.updatedAt, stale: false });
  } catch (error) {
    console.error("No se pudo leer Netlify Blobs:", error);
    return json({ error: "No se pudo leer el almacenamiento de lecturas." }, 503);
  }
};
