const axios = require("axios");
const logger = require("./logger");

const THRESHOLD_EUR = parseFloat(process.env.THRESHOLD_EUR || "0.10");

// Получаем текущую цену с Elering API
async function getCurrentPrice() {
  const now = new Date();
  const start = new Date(now);
  start.setMinutes(0, 0, 0);

  const end = new Date(start);
  end.setHours(end.getHours() + 1);

  const url = `https://dashboard.elering.ee/api/nps/price?start=${start.toISOString()}&end=${end.toISOString()}&fields=ee`;

  const response = await axios.get(url, { timeout: 5000 });
  const data = response.data;

  if (!data?.data?.ee || data.data.ee.length === 0) {
    throw new Error("No price data in Elering response");
  }

  // Цена приходит в EUR/MWh → переводим в EUR/kWh с НДС 22%
  const priceEurMwh = data.data.ee[0].price;
  const priceEurKwh = (priceEurMwh / 1000) * 1.22;

  return Math.round(priceEurKwh * 1000000) / 1000000; // 6 знаков после запятой
}

// Основная логика: сравниваем цену с порогом
async function getPriceDecision() {
  const price = await getCurrentPrice();
  const status = price <= THRESHOLD_EUR ? "ON" : "OFF";

  logger.info("Price check", {
    price_eur: price,
    threshold_eur: THRESHOLD_EUR,
    status,
  });

  return { status, current_price_eur: price, threshold: THRESHOLD_EUR };
}

module.exports = { getCurrentPrice, getPriceDecision, THRESHOLD_EUR };
