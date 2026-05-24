const client = require("prom-client");

// Включаем дефолтные метрики (CPU, RAM, и т.д.)
const collectDefaultMetrics = client.collectDefaultMetrics;
collectDefaultMetrics({ prefix: "elektri_vorg_" });

// API запросы — количество и latency
const httpRequestDuration = new client.Histogram({
  name: "elektri_vorg_http_request_duration_seconds",
  help: "Duration of HTTP requests in seconds",
  labelNames: ["method", "route", "status_code"],
  buckets: [0.01, 0.05, 0.1, 0.3, 0.5, 1, 2, 5],
});

const httpRequestTotal = new client.Counter({
  name: "elektri_vorg_http_requests_total",
  help: "Total number of HTTP requests",
  labelNames: ["method", "route", "status_code"],
});

// Команды устройств
const deviceCommandsTotal = new client.Counter({
  name: "elektri_vorg_device_commands_total",
  help: "Total number of device commands sent",
  labelNames: ["command"],
});

// Цена электричества
const electricityPrice = new client.Gauge({
  name: "elektri_vorg_electricity_price_eur",
  help: "Current electricity price in EUR/MWh",
});

// WebSocket подключения
const wsConnections = new client.Gauge({
  name: "elektri_vorg_websocket_connections",
  help: "Number of active WebSocket connections",
});

module.exports = {
  client,
  httpRequestDuration,
  httpRequestTotal,
  deviceCommandsTotal,
  electricityPrice,
  wsConnections,
};