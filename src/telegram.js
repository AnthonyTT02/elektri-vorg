const axios = require("axios");
const logger = require("./logger");

async function sendTelegram(message) {
  const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
  const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID;

  if (!TELEGRAM_BOT_TOKEN || !TELEGRAM_CHAT_ID) {
    logger.warn("Telegram not configured", { token: !!TELEGRAM_BOT_TOKEN, chat: !!TELEGRAM_CHAT_ID });
    return;
  }

  try {
    await axios.post(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
      chat_id: TELEGRAM_CHAT_ID,
      text: message,
      parse_mode: "HTML",
    });
    logger.info("Telegram message sent", { message });
  } catch (err) {
    logger.error("Telegram send failed", { message: err.message });
  }
}

module.exports = { sendTelegram };