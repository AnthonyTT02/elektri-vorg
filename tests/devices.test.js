const request = require("supertest");
const app = require("../src/index");
const { pool } = require("../src/db");
const jwt = require("jsonwebtoken");

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

// Генерируем тестовый JWT токен
const testToken = jwt.sign(
  { id: 1, username: "testuser", role: "user" },
  process.env.JWT_SECRET || "elektri-vorg-secret"
);

describe("Devices endpoints", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test("GET /api/devices — с токеном возвращает список устройств", async () => {
    pool.query.mockResolvedValue({
      rows: [
        { id: 1, name: "Boiler", description: "Main boiler", ip_address: "192.168.1.1", threshold_eur: 0.1 },
      ],
    });

    const res = await request(app)
      .get("/api/devices")
      .set("Authorization", `Bearer ${testToken}`);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  test("GET /api/devices — без токена возвращает 401", async () => {
    const res = await request(app).get("/api/devices");
    expect(res.status).toBe(401);
  });

  test("POST /api/devices — добавление устройства", async () => {
    pool.query.mockResolvedValue({
      rows: [{ id: 1, name: "Boiler", description: "Main boiler", ip_address: "192.168.1.1", threshold_eur: 0.1 }],
    });

    const res = await request(app)
      .post("/api/devices")
      .set("Authorization", `Bearer ${testToken}`)
      .send({ name: "Boiler", description: "Main boiler", ipAddress: "192.168.1.1", thresholdEur: 0.1 });

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("name", "Boiler");
  });

  test("POST /api/devices — без имени возвращает 400", async () => {
    const res = await request(app)
      .post("/api/devices")
      .set("Authorization", `Bearer ${testToken}`)
      .send({ description: "No name device" });

    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty("error");
  });

  test("DELETE /api/devices/:id — удаление устройства", async () => {
    pool.query.mockResolvedValue({ rows: [] });

    const res = await request(app)
      .delete("/api/devices/1")
      .set("Authorization", `Bearer ${testToken}`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("success", true);
  });

  test("PUT /api/devices/:id — обновление устройства", async () => {
    pool.query.mockResolvedValue({
      rows: [{ id: 1, name: "Updated Boiler", description: "Updated", ip_address: "192.168.1.2", threshold_eur: 0.2 }],
    });

    const res = await request(app)
      .put("/api/devices/1")
      .set("Authorization", `Bearer ${testToken}`)
      .send({ name: "Updated Boiler", description: "Updated", ipAddress: "192.168.1.2", thresholdEur: 0.2 });

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("name", "Updated Boiler");
  });

  test("POST /api/devices/:id/override — ручное управление", async () => {
    pool.query.mockResolvedValue({
      rows: [{ id: 1, is_override: true, override_status: "ON" }],
    });

    const res = await request(app)
      .post("/api/devices/1/override")
      .set("Authorization", `Bearer ${testToken}`)
      .send({ isOverride: true, overrideStatus: "ON" });

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("is_override", true);
  });
});