const express = require("express");
const cors = require("cors");
const { createServer } = require("http");
const { WebSocketServer } = require("ws");
const { getPriceDecision, get24HourForecast } = require("./priceService");
const { initDB, pool } = require("./db");
const { register, login, authenticate, requireAdmin } = require("./auth");
const { getDevices, addDevice, updateDevice, deleteDevice, setOverride, logCommand } = require("./devices");
const { sendTelegram } = require("./telegram");
const logger = require("./logger");

const app = express();
const server = createServer(app);
const wss = new WebSocketServer({ server });

const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

let lastStatus = null;

// WebSocket
wss.on("connection", (ws) => {
  logger.info("WebSocket client connected");

  getPriceDecision().then((data) => {
    ws.send(JSON.stringify(data));
  });

  ws.on("close", () => {
    logger.info("WebSocket client disconnected");
  });
});

// Обновляем всех клиентов каждые 30 секунд
setInterval(async () => {
  try {
    const data = await getPriceDecision();

    // Уведомление в Telegram если статус изменился
    if (lastStatus !== null && lastStatus !== data.status) {
      if (data.status === "ON") {
        await sendTelegram(`✅ <b>Бойлер включён!</b>\nЦена упала до <b>${data.current_price_eur} €/MWh</b>\nПорог: ${data.threshold} €/MWh`);
      } else {
        await sendTelegram(`❌ <b>Бойлер выключен!</b>\nЦена выросла до <b>${data.current_price_eur} €/MWh</b>\nПорог: ${data.threshold} €/MWh`);
      }
    }
    lastStatus = data.status;

    // Логируем команду для всех устройств
    const { rows: devices } = await pool.query("SELECT id FROM devices");
    for (const device of devices) {
      await logCommand(device.id, data.status, data.current_price_eur);
    }

    if (wss.clients.size === 0) return;
    wss.clients.forEach((client) => {
      if (client.readyState === 1) {
        client.send(JSON.stringify(data));
      }
    });
    logger.info("WebSocket broadcast", { price: data.current_price_eur, clients: wss.clients.size });
  } catch (err) {
    logger.error("WebSocket broadcast failed", { message: err.message });
  }
}, 30000);

// Health check
app.get("/health", (req, res) => {
  res.json({ status: "ok" });
});

// Тест Telegram
app.get("/api/test-telegram", async (req, res) => {
  await sendTelegram("🧪 Тест уведомления от Elektri Vorg!");
  res.json({ ok: true });
});

// Boiler status
app.get("/api/boiler/status", async (req, res) => {
  try {
    const result = await getPriceDecision();
    res.json(result);
  } catch (error) {
    logger.error("API failure", { event: "api_failure", message: error.message });
    res.status(502).json({ error: "Failed to fetch price data", message: error.message });
  }
});

// Прогноз цен на 24 часа
app.get("/api/forecast", async (req, res) => {
  try {
    const forecast = await get24HourForecast();
    res.json(forecast);
  } catch (error) {
    res.status(502).json({ error: "Failed to fetch forecast", message: error.message });
  }
});

// Отчёт экономии
app.get("/api/savings", authenticate, async (req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT 
        COUNT(*) FILTER (WHERE command = 'ON') as hours_on,
        COUNT(*) FILTER (WHERE command = 'OFF') as hours_off,
        AVG(price_eur) FILTER (WHERE command = 'ON') as avg_price_on,
        AVG(price_eur) FILTER (WHERE command = 'OFF') as avg_price_off,
        SUM(price_eur) FILTER (WHERE command = 'ON') as total_cost_smart,
        COUNT(*) as total_commands
      FROM command_logs
      WHERE created_at > NOW() - INTERVAL '30 days'
    `);

    const stats = rows[0];
    const hoursOn = parseInt(stats.hours_on) || 0;
    const hoursOff = parseInt(stats.hours_off) || 0;
    const avgPriceOn = parseFloat(stats.avg_price_on) || 0;
    const avgPriceOff = parseFloat(stats.avg_price_off) || 0;
    const totalCostSmart = parseFloat(stats.total_cost_smart) || 0;

    const avgPriceAll = (totalCostSmart + (avgPriceOff * hoursOff)) / (hoursOn + hoursOff) || 0;
    const costIfAlwaysOn = avgPriceAll * (hoursOn + hoursOff);
    const savings = costIfAlwaysOn - totalCostSmart;

    res.json({
      hours_on: hoursOn,
      hours_off: hoursOff,
      avg_price_on: Math.round(avgPriceOn * 1000000) / 1000000,
      avg_price_off: Math.round(avgPriceOff * 1000000) / 1000000,
      total_cost_smart: Math.round(totalCostSmart * 1000000) / 1000000,
      savings: Math.round(savings * 1000000) / 1000000,
      period_days: 30,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Авторизация
app.post("/api/auth/register", async (req, res) => {
  try {
    const { username, password, role } = req.body;
    if (!username || !password) {
      return res.status(400).json({ error: "Username and password required" });
    }
    const user = await register(username, password, role);
    res.json(user);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.post("/api/auth/login", async (req, res) => {
  try {
    const { username, password } = req.body;
    const result = await login(username, password);
    res.json(result);
  } catch (err) {
    res.status(401).json({ error: err.message });
  }
});

// Устройства
app.get("/api/devices", authenticate, async (req, res) => {
  try {
    const devices = await getDevices(req.user.id, req.user.role);
    res.json(devices);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post("/api/devices", authenticate, async (req, res) => {
  try {
    const { name, description, ipAddress, thresholdEur } = req.body;
    if (!name) return res.status(400).json({ error: "Name required" });
    const device = await addDevice(req.user.id, name, description, ipAddress, thresholdEur);
    res.json(device);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put("/api/devices/:id", authenticate, async (req, res) => {
  try {
    const device = await updateDevice(req.params.id, req.user.id, req.body);
    res.json(device);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete("/api/devices/:id", authenticate, async (req, res) => {
  try {
    await deleteDevice(req.params.id, req.user.id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post("/api/devices/:id/override", authenticate, async (req, res) => {
  try {
    const { isOverride, overrideStatus } = req.body;
    const device = await setOverride(req.params.id, req.user.id, isOverride, overrideStatus);
    res.json(device);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Запуск
if (require.main === module) {
  initDB().then(() => {
    server.listen(PORT, () => {
      logger.info("Server started", { port: PORT });
    });
  });
}

module.exports = app;