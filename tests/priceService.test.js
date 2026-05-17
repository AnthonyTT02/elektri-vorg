const request = require("supertest");
const axios = require("axios");
const app = require("../src/index");
const { getCurrentPrice, getPriceDecision } = require("../src/priceService");

// Мокаем axios чтобы тесты не зависели от внешнего API
jest.mock("axios");

const mockEleringResponse = {
  data: {
    data: {
      ee: [{ timestamp: 1700000000, price: 50 }], // 50 EUR/MWh
    },
  },
};

describe("priceService", () => {
  beforeEach(() => {
    axios.get.mockResolvedValue(mockEleringResponse);
  });

  test("getCurrentPrice возвращает правильно конвертированную цену", async () => {
    const price = await getCurrentPrice();
    // 50 EUR/MWh → (50/1000)*1.22 = 0.061 EUR/kWh
    expect(price).toBeCloseTo(0.061, 5);
  });

  test("getPriceDecision возвращает ON когда цена ниже порога", async () => {
    // Мок: цена 50 EUR/MWh = 0.061 EUR/kWh, порог по умолчанию 0.10
    const result = await getPriceDecision();
    expect(result.status).toBe("ON");
    expect(result.current_price_eur).toBeCloseTo(0.061, 5);
    expect(result.threshold).toBe(0.10);
  });

  test("getPriceDecision возвращает OFF когда цена выше порога", async () => {
    // Мок: высокая цена 200 EUR/MWh = 0.244 EUR/kWh
    axios.get.mockResolvedValue({
      data: { data: { ee: [{ timestamp: 1700000000, price: 200 }] } },
    });
    const result = await getPriceDecision();
    expect(result.status).toBe("OFF");
  });

  test("getCurrentPrice бросает ошибку при пустом ответе", async () => {
    axios.get.mockResolvedValue({ data: { data: { ee: [] } } });
    await expect(getCurrentPrice()).rejects.toThrow("No price data");
  });

  test("getCurrentPrice бросает ошибку при network failure", async () => {
    axios.get.mockRejectedValue(new Error("Network Error"));
    await expect(getCurrentPrice()).rejects.toThrow("Network Error");
  });
});

describe("API endpoints", () => {
  beforeEach(() => {
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

  test("GET /api/boiler/status возвращает 502 при ошибке API", async () => {
    axios.get.mockRejectedValue(new Error("Elering down"));
    const res = await request(app).get("/api/boiler/status");
    expect(res.status).toBe(502);
    expect(res.body).toHaveProperty("error");
  });
});
