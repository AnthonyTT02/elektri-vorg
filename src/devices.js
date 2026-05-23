const { pool } = require("./db");
const logger = require("./logger");

// Получить все устройства пользователя
async function getDevices(userId, role) {
  const query = role === "admin"
    ? "SELECT * FROM devices ORDER BY created_at DESC"
    : "SELECT * FROM devices WHERE user_id = $1 ORDER BY created_at DESC";
  const params = role === "admin" ? [] : [userId];
  const result = await pool.query(query, params);
  return result.rows;
}

// Добавить устройство
async function addDevice(userId, name, description, ipAddress, thresholdEur) {
  const result = await pool.query(
    "INSERT INTO devices (user_id, name, description, ip_address, threshold_eur) VALUES ($1, $2, $3, $4, $5) RETURNING *",
    [userId, name, description, ipAddress, thresholdEur || 0.10]
  );
  logger.info("Device added", { name, userId });
  return result.rows[0];
}

// Обновить устройство
async function updateDevice(deviceId, userId, updates) {
  const result = await pool.query(
    "UPDATE devices SET name=$1, description=$2, ip_address=$3, threshold_eur=$4 WHERE id=$5 AND user_id=$6 RETURNING *",
    [updates.name, updates.description, updates.ipAddress, updates.thresholdEur, deviceId, userId]
  );
  return result.rows[0];
}

// Удалить устройство
async function deleteDevice(deviceId, userId) {
  await pool.query(
    "DELETE FROM devices WHERE id=$1 AND user_id=$2",
    [deviceId, userId]
  );
  logger.info("Device deleted", { deviceId, userId });
}

// Override устройства
async function setOverride(deviceId, userId, isOverride, overrideStatus) {
  const result = await pool.query(
    "UPDATE devices SET is_override=$1, override_status=$2 WHERE id=$3 AND user_id=$4 RETURNING *",
    [isOverride, overrideStatus, deviceId, userId]
  );
  return result.rows[0];
}

// Логировать команду
async function logCommand(deviceId, command, priceEur) {
  await pool.query(
    "INSERT INTO command_logs (device_id, command, price_eur) VALUES ($1, $2, $3)",
    [deviceId, command, priceEur]
  );
  logger.info("Command sent", { deviceId, command, price_eur: priceEur });
}

module.exports = { getDevices, addDevice, updateDevice, deleteDevice, setOverride, logCommand };