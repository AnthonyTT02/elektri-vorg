const axios = require("axios");
const logger = require("./logger");

const THRESHOLD_EUR = parseFloat(process.env.THRESHOLD_EUR || "0.10");

// Кэш последней известней цены
let lastKnownPrice = null;

// Получаем текущую цену с Elering API
async function getCurrentPrice() {
  const now = new Date();
  const start = new Date(now);
  start.setMinutes(0, 0, 0);

  const end = new Date(start);
  end.setHours(end.getHours() + 1);

  const url = `https://dashboard.elering.ee/api/nps/price?start=${start.toISOString()}&end=${end.toISOString()}&fields=ee`;

  try {
    const response = await axios.get(url, { timeout: 5000 });
    const data = response.data;

    if (!data?.data?.ee || data.data.ee.length === 0) {
      throw new Error("No price data in Elering response");
    }

    const priceEurMwh = data.data.ee[0].price;
    const priceEurKwh = (priceEurMwh / 1000) * 1.22;
    const price = Math.round(priceEurKwh * 1000000) / 1000000;

    lastKnownPrice = price;
    return price;

  } catch (err) {
    if (lastKnownPrice !== null) {
      logger.warn("Elering API unavailable, using last known price", {
        error: err.message,
        lastKnownPrice,
      });
      return lastKnownPrice;
    }
    logger.error("Elering API unavailable and no cached price", { error: err.message });
    throw err;
  }
}

// Основная логика: сравниваем цену с порогом
async function getPriceDecision() {
  const price = await getCurrentPrice();

  if (price < 0) {
    logger.info("Negative price detected, boiler forced ON", { price });
    return { status: "ON", current_price_eur: price, threshold: THRESHOLD_EUR, note: "negative_price" };
  }

  const status = price <= THRESHOLD_EUR ? "ON" : "OFF";

  logger.info("Price check", {
    price_eur: price,
    threshold_eur: THRESHOLD_EUR,
    status,
  });

  return { status, current_price_eur: price, threshold: THRESHOLD_EUR };
}

// Получаем прогноз цен на 24 часа
async function get24HourForecast() {
  const now = new Date();
  const start = new Date(now);
  start.setMinutes(0, 0, 0);

  const end = new Date(start);
  end.setHours(end.getHours() + 24);

  const url = `https://dashboard.elering.ee/api/nps/price?start=${start.toISOString()}&end=${end.toISOString()}&fields=ee`;

  try {
    const response = await axios.get(url, { timeout: 5000 });
    const data = response.data;

    if (!data?.data?.ee || data.data.ee.length === 0) {
      throw new Error("No forecast data in Elering response");
    }

    return data.data.ee.map((item) => {
      const priceEurKwh = (item.price / 1000) * 1.22;
      const rounded = Math.round(priceEurKwh * 1000000) / 1000000;
      return {
        time: new Date(item.timestamp * 1000).toISOString(),
        price: rounded,
        below_threshold: rounded <= THRESHOLD_EUR,
      };
    });
  } catch (err) {
    logger.error("Forecast API unavailable", { error: err.message });
    throw err;
  }
}

// Для тестов — сброс кэша
function resetCache() {
  lastKnownPrice = null;
}

module.exports = { getCurrentPrice, getPriceDecision, get24HourForecast, THRESHOLD_EUR, resetCache };