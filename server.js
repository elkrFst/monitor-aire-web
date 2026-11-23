const http = require("node:http");
const os = require("node:os");
const path = require("node:path");
const fs = require("node:fs");

const PORT = Number(process.env.PORT || 3000);
const MAX_BODY_BYTES = 2048;
const webFiles = {
  "/": { file: "index.html", type: "text/html; charset=utf-8" },
  "/index.html": { file: "index.html", type: "text/html; charset=utf-8" },
  "/app.js": { file: "app.js", type: "text/javascript; charset=utf-8" },
  "/style.css": { file: "style.css", type: "text/css; charset=utf-8" }
};
const readingKeys = [
  "temperature1",
  "humidity1",
  "mq6",
  "temperature2",
  "humidity2",
  "mq2"
];
let readings = Object.fromEntries(readingKeys.map(key => [key, null]));
let updatedAt = null;
let lastReceivedAt = null;
const READING_TIMEOUT_MS = 15000;
const STALE_CHECK_INTERVAL_MS = 5000;
const clients = new Set();

function clearExpiredReadings() {
  if (!lastReceivedAt) return false;
  if (Date.now() - lastReceivedAt <= READING_TIMEOUT_MS) return false;
  readings = Object.fromEntries(readingKeys.map(key => [key, null]));
  updatedAt = new Date().toISOString();
  lastReceivedAt = null;
  return true;
}

function isReadingsStale() {
  if (!lastReceivedAt) return updatedAt !== null;
  return false;
}

function sendJson(response, statusCode, body) {
  response.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store"
  });
  response.end(JSON.stringify(body));
}

function readRequestBody(request) {
  return new Promise((resolve, reject) => {
    let body = "";
    let tooLarge = false;
    request.setEncoding("utf8");
    request.on("data", chunk => {
      if (tooLarge) return;
      body += chunk;
      if (Buffer.byteLength(body, "utf8") > MAX_BODY_BYTES) {
        tooLarge = true;
        reject(Object.assign(new Error("El cuerpo de la solicitud es demasiado grande."), { statusCode: 413 }));
      }
    });
    request.on("end", () => {
      if (!tooLarge) resolve(body);
    });
    request.on("error", error => {
      if (!tooLarge) reject(error);
    });
  });
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

function broadcastReadings() {
  const message = `data: ${JSON.stringify({ ...readings, updatedAt, stale: isReadingsStale() })}\n\n`;
  for (const client of clients) client.write(message);
}

async function handleReadings(request, response) {
  let payload;
  try {
    payload = JSON.parse(await readRequestBody(request));
  } catch (error) {
    const statusCode = error.statusCode || 400;
    if (!response.destroyed) {
      sendJson(response, statusCode, { error: statusCode === 400 ? "JSON invalido." : error.message });
    }
    return;
  }

  const validationError = validateReadings(payload);
  if (validationError) {
    sendJson(response, 400, { error: validationError });
    return;
  }

  readings = Object.fromEntries(readingKeys.map(key => [key, payload[key]]));
  updatedAt = new Date().toISOString();
  lastReceivedAt = Date.now();
  broadcastReadings();
  sendJson(response, 200, { ok: true, updatedAt });
}

function handleEvents(request, response) {
  response.writeHead(200, {
    "Content-Type": "text/event-stream; charset=utf-8",
    "Cache-Control": "no-cache, no-transform",
    "Connection": "keep-alive",
    "X-Accel-Buffering": "no"
  });
  clearExpiredReadings();
  response.write(`data: ${JSON.stringify({ ...readings, updatedAt, stale: isReadingsStale() })}\n\n`);
  clients.add(response);
  request.on("close", () => clients.delete(response));
}

const server = http.createServer((request, response) => {
  const requestUrl = new URL(request.url, "http://localhost");

  if (request.method === "GET" && requestUrl.pathname === "/api/readings") {
    clearExpiredReadings();
    sendJson(response, 200, { ...readings, updatedAt, stale: isReadingsStale() });
    return;
  }
  if (request.method === "GET" && requestUrl.pathname === "/api/events") {
    handleEvents(request, response);
    return;
  }
  if (request.method === "POST" && requestUrl.pathname === "/api/readings") {
    handleReadings(request, response);
    return;
  }
  if (request.method !== "GET") {
    sendJson(response, 405, { error: "Metodo no permitido." });
    return;
  }

  const webFile = webFiles[requestUrl.pathname];
  if (!webFile) {
    sendJson(response, 404, { error: "No encontrado." });
    return;
  }

  const filePath = path.join(__dirname, webFile.file);
  fs.readFile(filePath, (error, content) => {
    if (error) {
      console.error(`No se pudo leer ${webFile.file}:`, error);
      sendJson(response, 500, { error: "No se pudo cargar un archivo de la pagina." });
      return;
    }
    response.writeHead(200, {
      "Content-Type": webFile.type,
      "Cache-Control": "no-cache"
    });
    response.end(content);
  });
});

server.on("error", error => {
  console.error("No se pudo iniciar el servidor:", error.message);
  process.exitCode = 1;
});

server.listen(PORT, "0.0.0.0", () => {
  console.log(`Panel disponible en http://localhost:${PORT}`);
  const addresses = Object.values(os.networkInterfaces())
    .flat()
    .filter(network => network && network.family === "IPv4" && !network.internal)
    .map(network => network.address);
  for (const address of addresses) {
    console.log(`En esta red local: http://${address}:${PORT}`);
  }
  console.log("Mantén este proceso activo para recibir lecturas de los módulos.");
});

setInterval(() => {
  if (clearExpiredReadings()) broadcastReadings();
}, STALE_CHECK_INTERVAL_MS);
