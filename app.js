// Obtén el ID en Particle Console > Devices > tu dispositivo.
const DEMO_MODE = false;
const DEVICE_ID = "25001d000847313037363132";
// Obtén un token en Particle Console > Settings > Access Tokens.
// No publiques un token real en una aplicación web: cualquier visitante podría verlo.
const ACCESS_TOKEN = "";

const particle = !DEMO_MODE && typeof Particle !== "undefined" ? new Particle() : null;
const elements = {
  connection: document.getElementById("connection-status"),
  connectionLabel: document.getElementById("connection-label"),
  updated: document.getElementById("last-updated"),
  form: document.getElementById("threshold-form"),
  threshold: document.getElementById("threshold-input"),
  button: document.getElementById("threshold-button"),
  notice: document.getElementById("action-notice"),
  footerYear: document.getElementById("footer-year")
};

const HISTORY_LIMIT = 24;
const history = { labels: [], temperature: [], humidity: [], eco2: [] };
const latestValues = { temperature: null, humidity: null, eco2: null };
let activeThreshold = 1000;
let eventStream;
let historyChart;
let reconnectTimer = null;
let isConnecting = false;

function setConnection(state, label) {
  elements.connection.dataset.state = state;
  elements.connectionLabel.textContent = label;
}

function setNotice(type, message) {
  elements.notice.dataset.type = type;
  elements.notice.textContent = message;
  elements.notice.hidden = false;
}

function asFiniteNumber(value) {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function getMetric(payload, keys) {
  for (const key of keys) {
    const value = asFiniteNumber(payload[key]);
    if (value !== null) return value;
  }
  return null;
}

function setMetric(id, value, digits, state, label) {
  const card = document.querySelector(`[data-metric="${id}"]`);
  const output = document.getElementById(`${id === "eco2" ? "eco2" : id}-value`);
  const stateOutput = document.getElementById(`${id}-state`);
  output.textContent = value === null ? "--" : value.toFixed(digits);
  stateOutput.textContent = label;
  card.dataset.state = state;
}

function metricStatus(metric, value) {
  if (value === null) return { state: "unknown", label: "Sin datos" };
  if (metric === "temperature") {
    if (value < 18 || value > 28) return { state: "alert", label: "Alerta" };
    if (value < 20 || value > 26) return { state: "caution", label: "Precaución" };
    return { state: "good", label: "Confort" };
  }
  if (metric === "humidity") {
    if (value < 30 || value > 70) return { state: "alert", label: "Alerta" };
    if (value < 40 || value > 60) return { state: "caution", label: "Precaución" };
    return { state: "good", label: "Confort" };
  }
  if (value >= activeThreshold * 1.5) return { state: "alert", label: "Alerta" };
  if (value >= activeThreshold) return { state: "caution", label: "Precaución" };
  return { state: "good", label: "Buena" };
}

function addToHistory(values) {
  const now = new Date();
  history.labels.push(now.toLocaleTimeString("es", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit"
  }));
  history.temperature.push(values.temperature);
  history.humidity.push(values.humidity);
  history.eco2.push(values.eco2);

  while (history.labels.length > HISTORY_LIMIT) {
    for (const metric of Object.keys(history)) {
      history[metric].shift();
    }
  }

  if (!historyChart) return;
  historyChart.data.labels = [...history.labels];
  historyChart.data.datasets[0].data = [...history.temperature];
  historyChart.data.datasets[1].data = [...history.humidity];
  historyChart.data.datasets[2].data = [...history.eco2];
  historyChart.update("none");
}

function updateDashboard(payload) {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    setConnection("error", "Datos de evento no válidos");
    return;
  }

  // Acepta las llaves del JSON de la Photon 1 y también del Módulo 2 si se integra
  const receivedValues = {
    temperature: getMetric(payload, ["temperatura", "temperature", "temp"]),
    humidity: getMetric(payload, ["humedad", "humidity", "hum"]),
    eco2: getMetric(payload, ["eco2", "eCO2", "co2", "mq135", "mq2", "calidad_aire"])
  };

  if (Object.values(receivedValues).every(value => value === null)) {
    setConnection("error", "Evento sin métricas reconocidas");
    return;
  }

  for (const metric of Object.keys(receivedValues)) {
    if (receivedValues[metric] !== null) {
      latestValues[metric] = receivedValues[metric];
    }

    const status = metricStatus(metric, latestValues[metric]);
    setMetric(metric, latestValues[metric], metric === "eco2" ? 0 : 1, status.state, status.label);
  }

  addToHistory(latestValues);
  elements.updated.textContent = new Date().toLocaleTimeString("es", { hour12: false });
  setConnection("connected", "Conectado a Particle Cloud");
}

function parseEventData(event) {
  if (typeof event.data !== "string") return event.data;
  try {
    return JSON.parse(event.data);
  } catch (error) {
    throw new Error("El evento calidad_aire no contiene un JSON válido.");
  }
}

function initChart() {
  if (typeof Chart === "undefined") {
    console.error("Chart.js no está disponible; se omite la gráfica histórica.");
    return;
  }
  const context = document.getElementById("history-chart").getContext("2d");
  historyChart = new Chart(context, {
    type: "line",
    data: {
      labels: history.labels,
      datasets: [
        {
          label: "Temperatura (°C)",
          data: history.temperature,
          borderColor: "#f1b85b",
          backgroundColor: "rgba(241,184,91,.08)",
          yAxisID: "y",
          tension: 0.38,
          borderWidth: 2,
          pointRadius: 2,
          pointHoverRadius: 4,
          spanGaps: true
        },
        {
          label: "Humedad (%)",
          data: history.humidity,
          borderColor: "#54c9e8",
          backgroundColor: "rgba(84,201,232,.08)",
          yAxisID: "y",
          tension: 0.38,
          borderWidth: 2,
          pointRadius: 2,
          pointHoverRadius: 4,
          spanGaps: true
        },
        {
          label: "eCO₂ (ppm)",
          data: history.eco2,
          borderColor: "#58dfb0",
          backgroundColor: "rgba(88,223,176,.08)",
          yAxisID: "y1",
          tension: 0.38,
          borderWidth: 2,
          pointRadius: 2,
          pointHoverRadius: 4,
          spanGaps: true
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { intersect: false, mode: "index" },
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: "#18232e",
          borderColor: "rgba(165,190,208,.16)",
          borderWidth: 1,
          titleColor: "#dce7eb",
          bodyColor: "#9cacb5",
          padding: 10,
          displayColors: true
        }
      },
      scales: {
        x: {
          grid: { display: false },
          border: { display: false },
          ticks: { color: "#667580", maxTicksLimit: 6, font: { family: "DM Sans", size: 9 } }
        },
        y: {
          position: "left",
          grid: { color: "rgba(165,190,208,.07)" },
          border: { display: false },
          ticks: { color: "#667580", maxTicksLimit: 4, font: { family: "DM Sans", size: 9 } }
        },
        y1: {
          position: "right",
          display: false,
          grid: { drawOnChartArea: false }
        }
      }
    }
  });
}

function scheduleReconnect() {
  if (reconnectTimer) return;
  reconnectTimer = setTimeout(() => {
    reconnectTimer = null;
    connectToParticle();
  }, 5000);
}

async function connectToParticle() {
  if (isConnecting) return;

  if (!DEVICE_ID || DEVICE_ID.includes("PEGA_AQUI") || !ACCESS_TOKEN || ACCESS_TOKEN.includes("PEGA_AQUI")) {
    setConnection("offline", "Faltan credenciales en app.js");
    return;
  }

  if (!particle || typeof particle.getEventStream !== "function") {
    setConnection("error", "No se pudo cargar particle-api-js");
    return;
  }

  setConnection("offline", "Conectando a Particle Cloud…");
  isConnecting = true;

  try {
    const stream = await particle.getEventStream({
      deviceId: DEVICE_ID,
      name: "calidad_aire",
      auth: ACCESS_TOKEN
    });
    eventStream = stream;
    isConnecting = false;

    const handleDisconnect = (state, label) => {
      if (eventStream !== stream) return;
      eventStream = null;
      setConnection(state, label);
      scheduleReconnect();
    };

    setConnection("connected", "Esperando lectura del Photon…");

    stream.on("event", event => {
      if (eventStream !== stream) return;
      try {
        updateDashboard(parseEventData(event));
      } catch (error) {
        console.error("No se pudo procesar el evento calidad_aire:", error);
        setConnection("error", "Error al leer el JSON");
      }
    });

    stream.on("error", error => {
      console.error("Error en el flujo de Particle Cloud:", error);
      handleDisconnect("error", "Reconectando a Particle Cloud…");
    });

    stream.on("end", () => handleDisconnect("offline", "Flujo cerrado. Reconectando…"));
    stream.on("close", () => handleDisconnect("offline", "Flujo cerrado. Reconectando…"));
  } catch (error) {
    console.error("No se pudo conectar a Particle Cloud:", error);
    setConnection("error", "Sin conexión · reintentando…");
    scheduleReconnect();
  } finally {
    isConnecting = false;
  }
}

elements.form.addEventListener("submit", async event => {
  event.preventDefault();
  const threshold = Number(elements.threshold.value);

  if (!Number.isInteger(threshold) || threshold < 400 || threshold > 10000) {
    setNotice("error", "Ingresa un umbral entero entre 400 y 10 000 ppm.");
    elements.threshold.focus();
    return;
  }

  if (!DEVICE_ID || DEVICE_ID.includes("PEGA_AQUI") || !ACCESS_TOKEN || ACCESS_TOKEN.includes("PEGA_AQUI")) {
    setNotice("error", "Completa DEVICE_ID y ACCESS_TOKEN en app.js antes de enviar el comando.");
    return;
  }

  elements.button.disabled = true;
  elements.button.querySelector("span").textContent = "Enviando comando…";
  elements.notice.hidden = true;

  try {
    const response = await particle.callFunction({
      deviceId: DEVICE_ID,
      name: "setUmbral",
      argument: String(threshold),
      auth: ACCESS_TOKEN
    });

    if (response.return_value > 0) {
      activeThreshold = threshold;
      setNotice("success", `Umbral actualizado correctamente a ${threshold} ppm.`);
    } else {
      setNotice("error", `El dispositivo rechazó el umbral (código ${response.return_value}).`);
    }
  } catch (error) {
    console.error("Falló la llamada a setUmbral:", error);
    setNotice("error", "No fue posible actualizar el umbral. Verifica que la Photon esté en línea.");
  } finally {
    elements.button.disabled = false;
    elements.button.querySelector("span").textContent = "Actualizar umbral";
  }
});

elements.footerYear.textContent = new Date().getFullYear();
initChart();
connectToParticle();