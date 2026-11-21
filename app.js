const HISTORY_LIMIT = 24;
const metricDefinitions = {
  temperature1: { digits: 1, unit: "°C", chart: 0 },
  humidity1: { digits: 0, unit: "%", chart: 1 },
  mq9: { digits: 0, unit: "%", chart: 2 },
  temperature2: { digits: 1, unit: "°C", chart: 3 },
  humidity2: { digits: 0, unit: "%", chart: 4 },
  mq2: { digits: 0, unit: "%", chart: 5 }
};
const history = { labels: [], values: Object.fromEntries(
  Object.keys(metricDefinitions).map(metric => [metric, []])
) };
const latestValues = Object.fromEntries(
  Object.keys(metricDefinitions).map(metric => [metric, null])
);
const elements = {
  connection: document.getElementById("connection-status"),
  connectionLabel: document.getElementById("connection-label"),
  updated: document.getElementById("last-updated"),
  footerYear: document.getElementById("footer-year")
};
let historyChart;
let eventStream;
let hasReceivedData = false;

function setConnection(state, label) {
  elements.connection.dataset.state = state;
  elements.connectionLabel.textContent = label;
}

function asFiniteNumber(value) {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function metricStatus(metric, value) {
  if (value === null) return { state: "unknown", label: "Sin datos" };
  if (metric.startsWith("mq")) return { state: "unknown", label: "Escala relativa" };
  return { state: "good", label: "Lectura recibida" };
}

function setMetric(metric, value) {
  const definition = metricDefinitions[metric];
  const card = document.querySelector(`[data-metric="${metric}"]`);
  const output = document.getElementById(`${metric}-value`);
  const stateOutput = document.getElementById(`${metric}-state`);
  output.textContent = value === null ? "--" : value.toFixed(definition.digits);
  const status = metricStatus(metric, value);
  stateOutput.textContent = status.label;
  card.dataset.state = status.state;
}

function addToHistory(values) {
  history.labels.push(new Date().toLocaleTimeString("es", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit"
  }));
  for (const metric of Object.keys(metricDefinitions)) {
    history.values[metric].push(values[metric]);
  }
  while (history.labels.length > HISTORY_LIMIT) {
    history.labels.shift();
    for (const metric of Object.keys(metricDefinitions)) {
      history.values[metric].shift();
    }
  }
  if (!historyChart) return;
  historyChart.data.labels = [...history.labels];
  historyChart.data.datasets.forEach((dataset, index) => {
    const metric = Object.keys(metricDefinitions).find(
      key => metricDefinitions[key].chart === index
    );
    dataset.data = [...history.values[metric]];
  });
  historyChart.update("none");
}

function updateDashboard(payload) {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    setConnection("error", "Se recibieron datos no válidos");
    return;
  }

  for (const metric of Object.keys(metricDefinitions)) {
    const value = asFiniteNumber(payload[metric]);
    latestValues[metric] = value;
    setMetric(metric, value);
  }

  if (payload.updatedAt) {
    addToHistory(latestValues);
    elements.updated.textContent = new Date(payload.updatedAt).toLocaleTimeString("es", { hour12: false });
    hasReceivedData = true;
    setConnection("connected", "Datos recibidos de los módulos");
  } else {
    setConnection("connected", "Servidor local · esperando sensores");
  }
}

function connectToReadings() {
  if (typeof EventSource === "undefined") {
    setConnection("error", "Este navegador no admite eventos en tiempo real");
    return;
  }

  eventStream = new EventSource("/api/events");
  eventStream.onopen = () => {
    if (!hasReceivedData) setConnection("connected", "Servidor local conectado");
  };
  eventStream.onmessage = event => {
    try {
      updateDashboard(JSON.parse(event.data));
    } catch (error) {
      console.error("No se pudo procesar la lectura recibida:", error);
      setConnection("error", "Se recibieron datos no válidos");
    }
  };
  eventStream.onerror = () => {
    setConnection("offline", "Reconectando con el servidor local…");
  };
}

function initChart() {
  if (typeof Chart === "undefined") {
    console.error("Chart.js no está disponible; se omite la gráfica histórica.");
    return;
  }
  const datasets = [
    { label: "Temperatura M1 (°C)", metric: "temperature1", color: "#f1b85b", axis: "y" },
    { label: "Humedad M1 (%)", metric: "humidity1", color: "#54c9e8", axis: "y" },
    { label: "MQ-9 relativo (%)", metric: "mq9", color: "#58dfb0", axis: "y1" },
    { label: "Temperatura M2 (°C)", metric: "temperature2", color: "#ff8c69", axis: "y" },
    { label: "Humedad M2 (%)", metric: "humidity2", color: "#a99bff", axis: "y" },
    { label: "MQ-2 relativo (%)", metric: "mq2", color: "#f47fa5", axis: "y1" }
  ];
  historyChart = new Chart(document.getElementById("history-chart").getContext("2d"), {
    type: "line",
    data: {
      labels: history.labels,
      datasets: datasets.map(dataset => ({
        label: dataset.label,
        data: history.values[dataset.metric],
        borderColor: dataset.color,
        backgroundColor: `${dataset.color}18`,
        yAxisID: dataset.axis,
        tension: 0.35,
        borderWidth: 2,
        pointRadius: 2,
        pointHoverRadius: 4,
        spanGaps: true
      }))
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
          padding: 10
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
          min: 0,
          max: 100,
          grid: { drawOnChartArea: false },
          border: { display: false },
          ticks: { color: "#667580", maxTicksLimit: 4, font: { family: "DM Sans", size: 9 } }
        }
      }
    }
  });
}

elements.footerYear.textContent = new Date().getFullYear();
initChart();
connectToReadings();
