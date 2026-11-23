const HISTORY_LIMIT = 24;
const metricDefinitions = {
  temperature1: { digits: 1 },
  humidity1: { digits: 0 },
  mq6: { digits: 0 },
  temperature2: { digits: 1 },
  humidity2: { digits: 0 },
  mq2: { digits: 0 }
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
  footerYear: document.getElementById("footer-year"),
  themeToggle: document.getElementById("theme-toggle"),
  themeLabel: document.getElementById("theme-label"),
  themeColor: document.querySelector('meta[name="theme-color"]')
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

function metricStatus(value) {
  if (value === null) return { state: "unknown", label: "Sin datos" };
  return { state: "connected", label: "Lectura recibida" };
}

function markReadingsStale() {
  for (const metric of Object.keys(metricDefinitions)) {
    latestValues[metric] = null;
    setMetric(metric, null);
  }
  history.labels = [];
  for (const metric of Object.keys(metricDefinitions)) {
    history.values[metric] = [];
  }
  if (historyChart) {
    historyChart.data.labels = [];
    historyChart.data.datasets.forEach(dataset => {
      dataset.data = [];
    });
    historyChart.update("none");
  }
  setConnection("offline", "Sin lecturas · módulo desconectado");
  elements.updated.textContent = "--:--:--";
}

function setMetric(metric, value) {
  const definition = metricDefinitions[metric];
  const card = document.querySelector(`[data-metric="${metric}"]`);
  const output = document.getElementById(`${metric}-value`);
  const stateOutput = document.getElementById(`${metric}-state`);
  output.textContent = value === null ? "--" : value.toFixed(definition.digits);
  const status = metricStatus(value);
  stateOutput.textContent = status.label;
  card.dataset.state = status.state;
}

function addToHistory(values) {
  if (Object.values(values).every(value => value === null)) return;
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
  historyChart.data.datasets.forEach(dataset => {
    dataset.data = [...history.values[dataset.metric]];
  });
  historyChart.update("none");
}

function updateDashboard(payload) {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    setConnection("error", "Se recibieron datos no válidos");
    return;
  }

  if (payload.stale === true) {
    markReadingsStale();
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
    { label: "Temperatura · Photon 1 (°C)", metric: "temperature1", color: "--orange", axis: "y", dash: [] },
    { label: "Temperatura · ESP8266 (°C)", metric: "temperature2", color: "--cyan", axis: "y", dash: [] },
    { label: "Humedad · Photon 1 (%)", metric: "humidity1", color: "--orange", axis: "y1", dash: [5, 4] },
    { label: "Humedad · ESP8266 (%)", metric: "humidity2", color: "--cyan", axis: "y1", dash: [5, 4] }
  ];
  historyChart = new Chart(document.getElementById("history-chart").getContext("2d"), {
    type: "line",
    data: {
      labels: history.labels,
      datasets: datasets.map(dataset => ({
        label: dataset.label,
        metric: dataset.metric,
        data: history.values[dataset.metric],
        borderColor: getThemeColor(dataset.color),
        backgroundColor: getThemeColor(dataset.color),
        yAxisID: dataset.axis,
        borderDash: dataset.dash,
        tension: 0.35,
        borderWidth: 1.8,
        pointRadius: 1,
        pointHoverRadius: 3,
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
          backgroundColor: getThemeColor("--surface"),
          borderColor: getThemeColor("--line"),
          borderWidth: 1,
          titleColor: getThemeColor("--text"),
          bodyColor: getThemeColor("--muted"),
          padding: 10
        }
      },
      scales: {
        x: {
          grid: { display: false },
          border: { color: getThemeColor("--line") },
          ticks: { color: getThemeColor("--chart-tick"), maxTicksLimit: 6, font: { family: "DM Sans", size: 9 } }
        },
        y: {
          position: "left",
          grid: { color: getThemeColor("--grid") },
          border: { display: false },
          ticks: { color: getThemeColor("--chart-tick"), maxTicksLimit: 4, font: { family: "DM Sans", size: 9 } }
        },
        y1: {
          position: "right",
          min: 0,
          max: 100,
          grid: { drawOnChartArea: false },
          border: { display: false },
          ticks: { color: getThemeColor("--chart-tick"), maxTicksLimit: 4, font: { family: "DM Sans", size: 9 } }
        }
      }
    }
  });
}

function getThemeColor(token) {
  return getComputedStyle(document.documentElement).getPropertyValue(token).trim();
}

function applyTheme(theme) {
  const isLight = theme === "light";
  document.documentElement.dataset.theme = theme;
  elements.themeLabel.textContent = isLight ? "Modo oscuro" : "Modo claro";
  elements.themeToggle.setAttribute("aria-label", `Cambiar a ${isLight ? "modo oscuro" : "modo claro"}`);
  elements.themeToggle.title = `Cambiar a ${isLight ? "modo oscuro" : "modo claro"}`;
  elements.themeColor.content = isLight ? "#f4f6f3" : "#101619";

  try {
    localStorage.setItem("aire-theme", theme);
  } catch (error) {
    console.warn("No se pudo guardar la preferencia de tema.");
  }

  if (!historyChart) return;
  historyChart.data.datasets.forEach(dataset => {
    const colorToken = dataset.metric.endsWith("1") ? "--orange" : "--cyan";
    dataset.borderColor = getThemeColor(colorToken);
    dataset.backgroundColor = getThemeColor(colorToken);
  });
  historyChart.options.plugins.tooltip.backgroundColor = getThemeColor("--surface");
  historyChart.options.plugins.tooltip.borderColor = getThemeColor("--line");
  historyChart.options.plugins.tooltip.titleColor = getThemeColor("--text");
  historyChart.options.plugins.tooltip.bodyColor = getThemeColor("--muted");
  historyChart.options.scales.x.border.color = getThemeColor("--line");
  historyChart.options.scales.x.ticks.color = getThemeColor("--chart-tick");
  historyChart.options.scales.y.grid.color = getThemeColor("--grid");
  historyChart.options.scales.y.ticks.color = getThemeColor("--chart-tick");
  historyChart.options.scales.y1.ticks.color = getThemeColor("--chart-tick");
  historyChart.update();
}

elements.themeToggle.addEventListener("click", () => {
  const nextTheme = document.documentElement.dataset.theme === "dark" ? "light" : "dark";
  applyTheme(nextTheme);
});

elements.footerYear.textContent = new Date().getFullYear();
initChart();
applyTheme(document.documentElement.dataset.theme === "light" ? "light" : "dark");
connectToReadings();
