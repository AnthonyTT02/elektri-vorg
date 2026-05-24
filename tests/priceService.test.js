const request = require("supertest");
const axios = require("axios");
const app = require("../src/index");

jest.mock("axios");

jest.mock("../src/logger", () => ({
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
}));

jest.mock("../src/db", () => ({
  pool: { query: jest.fn().mockResolvedValue({ rows: [] }) },
  initDB: jest.fn().mockResolvedValue(),
}));

const { getCurrentPrice, getPriceDecision, resetCache } = require("../src/priceService");

const mockEleringResponse = {
  data: {
    data: {
      ee: [{ timestamp: 1700000000, price: 50 }],
    },
  },
};

describe("priceService", () => {
  beforeEach(() => {
    resetCache();
    axios.get.mockResolvedValue(mockEleringResponse);
  });

  test("getCurrentPrice возвращает правильно конвертированную цену", async () => {
    const price = await getCurrentPrice();
    expect(price).toBeCloseTo(0.061, 5);
  });

  test("getPriceDecision возвращает ON когда цена ниже порога", async () => {
    const result = await getPriceDecision();
    expect(result.status).toBe("ON");
    expect(result.current_price_eur).toBeCloseTo(0.061, 5);
    expect(result.threshold).toBe(0.10);
  });

  test("getPriceDecision возвращает OFF когда цена выше порога", async () => {
    axios.get.mockResolvedValue({
      data: { data: { ee: [{ timestamp: 1700000000, price: 200 }] } },
    });
    const result = await getPriceDecision();
    expect(result.status).toBe("OFF");
  });

  test("getCurrentPrice бросает ошибку при пустом ответе без кэша", async () => {
    axios.get.mockResolvedValue({ data: { data: { ee: [] } } });
    await expect(getCurrentPrice()).rejects.toThrow("No price data");
  });

  test("getCurrentPrice бросает ошибку при network failure без кэша", async () => {
    axios.get.mockRejectedValue(new Error("Network Error"));
    await expect(getCurrentPrice()).rejects.toThrow("Network Error");
  });

  test("getCurrentPrice возвращает кэш при недоступном API", async () => {
    await getCurrentPrice(); // заполняем кэш
    axios.get.mockRejectedValue(new Error("Elering down"));
    const price = await getCurrentPrice();
    expect(price).toBeCloseTo(0.061, 5);
  });

  test("getPriceDecision возвращает ON при отрицательной цене", async () => {
    axios.get.mockResolvedValue({
      data: { data: { ee: [{ timestamp: 1700000000, price: -10 }] } },
    });
    const result = await getPriceDecision();
    expect(result.status).toBe("ON");
    expect(result.note).toBe("negative_price");
  });
});

describe("API endpoints", () => {
  beforeEach(() => {
    resetCache();
    axios.get.mockResolvedValue(mockEleringResponse);
  });

  test("GET /api/boiler/status возвращает корректный JSON", async () => {
    const res = await request(app).get("/api/boiler/status");
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("status");
    expect(res.body).toHaveProperty("current_price_eur");
    expect(res.body).toHaveProperty("threshold");
    expect(["ON", "OFF"]).toContain(res.body.status);
  });

  test("GET /health возвращает ok", async () => {
    const res = await request(app).get("/health");
    expect(res.status).toBe(200);
    expect(res.body.status).toBe("ok");
  });

  test("GET /api/boiler/status возвращает 502 при ошибке API без кэша", async () => {
    axios.get.mockRejectedValue(new Error("Elering down"));
    const res = await request(app).get("/api/boiler/status");
    expect(res.status).toBe(502);
    expect(res.body).toHaveProperty("error");
  });
});