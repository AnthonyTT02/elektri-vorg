const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { pool } = require("./db");
const logger = require("./logger");

const JWT_SECRET = process.env.JWT_SECRET || "elektri-vorg-secret";

// Регистрация
async function register(username, password, role = "user") {
  const hashedPassword = await bcrypt.hash(password, 10);
  const result = await pool.query(
    "INSERT INTO users (username, password, role) VALUES ($1, $2, $3) RETURNING id, username, role",
    [username, hashedPassword, role]
  );
  logger.info("User registered", { username });
  return result.rows[0];
}

// Логин
async function login(username, password) {
  const result = await pool.query(
    "SELECT * FROM users WHERE username = $1",
    [username]
  );
  if (result.rows.length === 0) {
    throw new Error("User not found");
  }
  const user = result.rows[0];
  const valid = await bcrypt.compare(password, user.password);
  if (!valid) {
    throw new Error("Invalid password");
  }
  const token = jwt.sign(
    { id: user.id, username: user.username, role: user.role },
    JWT_SECRET,
    { expiresIn: "24h" }
  );
  logger.info("User logged in", { username });
  return { token, user: { id: user.id, username: user.username, role: user.role } };
}

// Middleware проверки токена
function authenticate(req, res, next) {
  const token = req.headers.authorization?.split(" ")[1];
  if (!token) {
    return res.status(401).json({ error: "No token provided" });
  }
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    return res.status(401).json({ error: "Invalid token" });
  }
}

// Middleware проверки роли admin
function requireAdmin(req, res, next) {
  if (req.user.role !== "admin") {
    return res.status(403).json({ error: "Admin access required" });
  }
  next();
}

module.exports = { register, login, authenticate, requireAdmin };