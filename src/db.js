const { Pool } = require("pg");
const logger = require("./logger");

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: false,
});

pool.on("connect", () => {
  logger.info("Database connected");
});

pool.on("error", (err) => {
  logger.error("Database error", { event: "db_error", message: err.message });
});

// Создаём таблицы если их нет
async function initDB() {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        username VARCHAR(50) UNIQUE NOT NULL,
        password VARCHAR(255) NOT NULL,
        role VARCHAR(10) DEFAULT 'user',
        vacation_mode BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS devices (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id),
        name VARCHAR(100) NOT NULL,
        description TEXT,
        ip_address VARCHAR(50),
        threshold_eur DECIMAL(10,6) DEFAULT 0.10,
        is_override BOOLEAN DEFAULT FALSE,
        override_status VARCHAR(3),
        created_at TIMESTAMP DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS command_logs (
        id SERIAL PRIMARY KEY,
        device_id INTEGER REFERENCES devices(id),
        command VARCHAR(10) NOT NULL,
        price_eur DECIMAL(10,6),
        created_at TIMESTAMP DEFAULT NOW()
      );
    `);

    // Добавляем колонку если её нет (для существующей БД)
    await pool.query(`
      ALTER TABLE users ADD COLUMN IF NOT EXISTS vacation_mode BOOLEAN DEFAULT FALSE;
    `);

    logger.info("Database initialized");
  } catch (err) {
    logger.error("Database init error", { message: err.message });
  }
}

module.exports = { pool, initDB };