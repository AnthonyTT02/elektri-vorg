const request = require("supertest");
const app = require("../src/index");
const { pool } = require("../src/db");

// Мокаем БД
jest.mock("../src/db", () => ({
  pool: {
    query: jest.fn(),
  },
  initDB: jest.fn().mockResolvedValue(),
}));

// Мокаем logger
jest.mock("../src/logger", () => ({
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
}));

describe("Auth endpoints", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test("POST /api/auth/register — успешная регистрация", async () => {
    pool.query.mockResolvedValue({
      rows: [{ id: 1, username: "testuser", role: "user" }],
    });

    const res = await request(app)
      .post("/api/auth/register")
      .send({ username: "testuser", password: "password123" });

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("username", "testuser");
  });

  test("POST /api/auth/register — без username возвращает 400", async () => {
    const res = await request(app)
      .post("/api/auth/register")
      .send({ password: "password123" });

    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty("error");
  });

  test("POST /api/auth/register — без password возвращает 400", async () => {
    const res = await request(app)
      .post("/api/auth/register")
      .send({ username: "testuser" });

    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty("error");
  });

  test("POST /api/auth/login — успешный логин возвращает token", async () => {
    const bcrypt = require("bcryptjs");
    const hashedPassword = await bcrypt.hash("password123", 10);

    pool.query.mockResolvedValue({
      rows: [{
        id: 1,
        username: "testuser",
        password: hashedPassword,
        role: "user",
      }],
    });

    const res = await request(app)
      .post("/api/auth/login")
      .send({ username: "testuser", password: "password123" });

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("token");
    expect(res.body).toHaveProperty("user");
  });

  test("POST /api/auth/login — неверный пароль возвращает 401", async () => {
    const bcrypt = require("bcryptjs");
    const hashedPassword = await bcrypt.hash("correctpassword", 10);

    pool.query.mockResolvedValue({
      rows: [{
        id: 1,
        username: "testuser",
        password: hashedPassword,
        role: "user",
      }],
    });

    const res = await request(app)
      .post("/api/auth/login")
      .send({ username: "testuser", password: "wrongpassword" });

    expect(res.status).toBe(401);
    expect(res.body).toHaveProperty("error");
  });

  test("POST /api/auth/login — несуществующий пользователь возвращает 401", async () => {
    pool.query.mockResolvedValue({ rows: [] });

    const res = await request(app)
      .post("/api/auth/login")
      .send({ username: "nobody", password: "password123" });

    expect(res.status).toBe(401);
    expect(res.body).toHaveProperty("error");
  });

  test("GET /api/devices — без токена возвращает 401", async () => {
    const res = await request(app).get("/api/devices");
    expect(res.status).toBe(401);
  });
});