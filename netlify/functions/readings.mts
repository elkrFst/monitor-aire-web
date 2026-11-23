import { getStore } from "@netlify/blobs";
import type { Config, Context } from "@netlify/functions";

const STORE_NAME = "sensor-readings";
const READING_TIMEOUT_MS = 15_000;
const readingKeys = [
  "temperature1",
  "humidity1",
  "mq6",
  "temperature2",
  "humidity2",
  "mq2",
] as const;

type ReadingKey = (typeof readingKeys)[number];
type Readings = Record<ReadingKey, number | null>;

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}

function validateReadings(value: unknown): string | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return "Se esperaba un objeto JSON.";
  }

  const payload = value as Record<string, unknown>;
  for (const key of readingKeys) {
    if (!Object.prototype.hasOwnProperty.call(payload, key)) {
      return `Falta la lectura ${key}.`;
    }
    const reading = payload[key];
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

export default async function handler(request: Request, _context: Context): Promise<Response> {
  const store = getStore(STORE_NAME);

  if (request.method === "POST") {
    let payload: unknown;
    try {
      payload = await request.json();
    } catch {
      return json({ error: "JSON invalido." }, 400);
    }

    const validationError = validateReadings(payload);
    if (validationError) return json({ error: validationError }, 400);

    const readings = payload as Record<ReadingKey, number | null>;
    const record = {
      readings: Object.fromEntries(
        readingKeys.map(key => [key, readings[key]])
      ) as Readings,
      updatedAt: new Date().toISOString(),
      receivedAt: Date.now(),
    };

    await store.setJSON("latest", record);
    return json({ ok: true, updatedAt: record.updatedAt });
  }

  if (request.method !== "GET") {
    return json({ error: "Metodo no permitido." }, 405);
  }

  const record = await store.get("latest", { type: "json" }) as
    | { readings: Readings; updatedAt: string; receivedAt: number }
    | null;

  if (!record) {
    return json({
      temperature1: null,
      humidity1: null,
      mq6: null,
      temperature2: null,
      humidity2: null,
      mq2: null,
      updatedAt: null,
      stale: true,
    });
  }

  const stale = Date.now() - record.receivedAt > READING_TIMEOUT_MS;
  if (stale) {
    return json({
      temperature1: null,
      humidity1: null,
      mq6: null,
      temperature2: null,
      humidity2: null,
      mq2: null,
      updatedAt: record.updatedAt,
      stale: true,
    });
  }

  return json({ ...record.readings, updatedAt: record.updatedAt, stale: false });
}

export const config: Config = {
  path: "/api/readings",
};
