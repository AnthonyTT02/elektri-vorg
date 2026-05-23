const express = require("express");
const cors = require("cors");
const { getPriceDecision } = require("./priceService");
const { initDB } = require("./db");
const { register, login, authenticate, requireAdmin } = require("./auth");
const { getDevices, addDevice, updateDevice, deleteDevice, setOverride, logCommand } = require("./devices");
const logger = require("./logger");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// Health check
app.get("/health", (req, res) => {
  res.json({ status: "ok" });
});

// Boiler status (публичный endpoint для устройств)
app.get("/api/boiler/status", async (req, res) => {
  try {
    const result = await getPriceDecision();
    res.json(result);
  } catch (error) {
    logger.error("API failure", { event: "api_failure", message: error.message });
    res.status(502).json({ error: "Failed to fetch price data", message: error.message });
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
    app.listen(PORT, () => {
      logger.info("Server started", { port: PORT });
    });
  });
}

module.exports = app;