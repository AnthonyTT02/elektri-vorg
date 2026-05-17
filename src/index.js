const express = require("express");
const { getPriceDecision } = require("./priceService");
const logger = require("./logger");

const app = express();
const PORT = process.env.PORT || 3000;

// Главный endpoint для устройства
app.get("/api/boiler/status", async (req, res) => {
  try {
    const result = await getPriceDecision();
    res.json(result);
  } catch (error) {
    logger.error("API failure", {
      event: "api_failure",
      message: error.message,
    });
    res.status(502).json({ error: "Failed to fetch price data", message: error.message });
  }
});

// Health check для Coolify
app.get("/health", (req, res) => {
  res.json({ status: "ok" });
});

// Запускаем только если не в тестовом режиме
if (require.main === module) {
  app.listen(PORT, () => {
    logger.info("Server started", { port: PORT });
  });
}

module.exports = app;
