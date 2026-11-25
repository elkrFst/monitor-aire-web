const { getStore } = require("@netlify/blobs");
const {
  MODULE_FIELDS,
  buildDashboardReadings,
  decodeReadingUpdate
} = require("../../reading-schema");

const STORE_NAME = "sensor-readings";
const NETLIFY_SITE_ID = "86f119f5-5dc8-4ea4-a63e-b7c59937e3d1";
const moduleNames = Object.keys(MODULE_FIELDS);

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

    const update = decodeReadingUpdate(payload);
    if (update.error) return json({ error: update.error }, 400);

    if (!store) {
      return json({ error: "El almacenamiento de lecturas no esta disponible." }, 503);
    }

    const record = {
      readings: update.readings,
      updatedAt: new Date().toISOString(),
      receivedAt: Date.now()
    };

    try {
      await store.setJSON(`latest-${update.source}`, record);
      return json({ ok: true, source: update.source, updatedAt: record.updatedAt });
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
    const entries = await Promise.all(moduleNames.map(async source => [
      source,
      await store.get(`latest-${source}`, { type: "json" })
    ]));
    const records = Object.fromEntries(entries);
    return json(buildDashboardReadings(records));
  } catch (error) {
    console.error("No se pudo leer Netlify Blobs:", error);
    return json({ error: "No se pudo leer el almacenamiento de lecturas." }, 503);
  }
};
