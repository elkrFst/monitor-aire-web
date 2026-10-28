// Completa estas credenciales con los datos del dispositivo en Particle Console.
// Limita el alcance del token a este dispositivo y evita publicar este archivo con el token real.
const DEVICE_ID = "25001d000847313037363132";
const ACCESS_TOKEN = "90e096fcbf182c0993bb68f31a3287af295180f0";

const particle = new Particle();
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
let activeThreshold = 1000;
let eventStream;
let historyChart;

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
    if (value < 18 || value > 30) return { state: "alert", label: "Fuera de rango" };
    if (value < 20 || value > 26) return { state: "caution", label: "Precaución" };
    return { state: "good", label: "Confort" };
  }
  if (metric === "humidity") {
    if (value < 20 || value > 70) return { state: "alert", label: "Fuera de rango" };
    if (value < 30 || value > 60) return { state: "caution", label: "Precaución" };
    return { state: "good", label: "Confort" };
  }
  if (value >= activeThreshold * 1.5) return { state: "alert", label: "Alerta" };
  if (value >= activeThreshold) return { state: "caution", label: "Precaución" };
  return { state: "good", label: "Buena" };
}

function addToHistory(values) {
  const now = new Date();
  history.labels.push(now.toLocaleTimeString("es", { hour: "2-digit", minute: "2-digit", second: "2-digit" }));
  history.temperature.push(values.temperature);
  history.humidity.push(values.humidity);
  history.eco2.push(values.eco2);
  while (history.labels.length > HISTORY_LIMIT) {
    for (const metric of Object.keys(history)) history[metric].shift();
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

  const values = {
    temperature: getMetric(payload, ["temperature", "temperatura", "temp"]),
    humidity: getMetric(payload, ["humidity", "humedad", "relative_humidity"]),
    eco2: getMetric(payload, ["eco2", "eCO2", "co2", "calidad_aire"])
  };
  if (Object.values(values).every(value => value === null)) {
    setConnection("error", "Evento sin métricas reconocidas");
    return;
  }

  for (const metric of Object.keys(values)) {
    const status = metricStatus(metric, values[metric]);
    setMetric(metric, values[metric], metric === "eco2" ? 0 : 1, status.state, status.label);
  }
  addToHistory(values);
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
        { label: "Temperatura (°C)", data: history.temperature, borderColor: "#f1b85b", backgroundColor: "rgba(241,184,91,.08)", yAxisID: "y", tension: .38, borderWidth: 2, pointRadius: 2, pointHoverRadius: 4, spanGaps: true },
        { label: "Humedad (%)", data: history.humidity, borderColor: "#54c9e8", backgroundColor: "rgba(84,201,232,.08)", yAxisID: "y", tension: .38, borderWidth: 2, pointRadius: 2, pointHoverRadius: 4, spanGaps: true },
        { label: "eCO₂ (ppm)", data: history.eco2, borderColor: "#58dfb0", backgroundColor: "rgba(88,223,176,.08)", yAxisID: "y1", tension: .38, borderWidth: 2, pointRadius: 2, pointHoverRadius: 4, spanGaps: true }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { intersect: false, mode: "index" },
      plugins: {
        legend: { display: false },
        tooltip: { backgroundColor: "#18232e", borderColor: "rgba(165,190,208,.16)", borderWidth: 1, titleColor: "#dce7eb", bodyColor: "#9cacb5", padding: 10, displayColors: true }
      },
      scales: {
        x: { grid: { display: false }, border: { display: false }, ticks: { color: "#667580", maxTicksLimit: 6, font: { family: "DM Sans", size: 9 } } },
        y: { position: "left", grid: { color: "rgba(165,190,208,.07)" }, border: { display: false }, ticks: { color: "#667580", maxTicksLimit: 4, font: { family: "DM Sans", size: 9 } } },
        y1: { position: "right", display: false, grid: { drawOnChartArea: false } }
      }
    }
  });
}

async function connectToParticle() {
  if (!DEVICE_ID || !ACCESS_TOKEN) {
    setConnection("offline", "Configura tus credenciales de Particle");
    return;
  }
  if (typeof particle.getEventStream !== "function") {
    setConnection("error", "No se pudo cargar Particle Cloud");
    return;
  }

  setConnection("offline", "Conectando a Particle Cloud…");
  try {
    eventStream = await particle.getEventStream({
      deviceId: DEVICE_ID,
      name: "calidad_aire",
      auth: ACCESS_TOKEN
    });
    eventStream.on("event", event => {
      try {
        updateDashboard(parseEventData(event));
      } catch (error) {
        console.error("No se pudo procesar el evento calidad_aire:", error);
        setConnection("error", "Error al leer los datos");
      }
    });
    eventStream.on("error", error => {
      console.error("Error en el flujo de Particle Cloud:", error);
      setConnection("error", "Error de conexión con Particle Cloud");
    });
    eventStream.on("end", () => setConnection("offline", "Flujo de Particle Cloud finalizado"));
  } catch (error) {
    console.error("No se pudo conectar a Particle Cloud:", error);
    setConnection("error", "No se pudo conectar a Particle Cloud");
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
  if (!DEVICE_ID || !ACCESS_TOKEN) {
    setNotice("error", "Completa DEVICE_ID y ACCESS_TOKEN en app.js antes de enviar el comando.");
    return;
  }
  if (typeof particle.callFunction !== "function") {
    setNotice("error", "No se pudo cargar la librería de Particle Cloud.");
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
    setNotice("error", "No fue posible actualizar el umbral. Verifica la conexión y la configuración del dispositivo.");
  } finally {
    elements.button.disabled = false;
    elements.button.querySelector("span").textContent = "Actualizar umbral";
  }
});

elements.footerYear.textContent = new Date().getFullYear();
initChart();
connectToParticle();
