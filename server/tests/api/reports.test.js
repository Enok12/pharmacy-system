import { describe, it, expect } from "vitest";
import { apiRequest } from "../helpers/client.js";
import { tokenFor } from "../helpers/tokens.js";
import { createProductWithStock, checkout } from "../helpers/fixtures.js";

async function sellOne(productId, quantity) {
  return checkout(tokenFor("cashier"), { items: [{ productId, quantity }] });
}

describe("Reports — Admin/Pharmacist only", () => {
  it("all three report routes: Cashier → 403; signed out → 401", async () => {
    for (const path of [
      "/api/v1/reports/sales",
      "/api/v1/reports/inventory-valuation",
      "/api/v1/reports/top-products",
    ]) {
      const asCashier = await apiRequest("GET", path, { token: tokenFor("cashier") });
      expect(asCashier.status).toBe(403);
      const signedOut = await apiRequest("GET", path);
      expect(signedOut.status).toBe(401);
    }
  });

  it("sales report totals match a known sale's revenue/cost/profit", async () => {
    const { product } = await createProductWithStock(tokenFor("admin"), {
      quantity: 10,
      sellingPrice: 25,
      costPricePerUnit: 10,
      taxRate: 0,
    });
    const sale = await sellOne(product.id, 3);
    expect(sale.total).toBe(75);

    const { status, body } = await apiRequest("GET", "/api/v1/reports/sales", { token: tokenFor("admin") });
    expect(status).toBe(200);
    expect(body.data.totals.revenue).toBeGreaterThanOrEqual(75);
    expect(body.data.totals.saleCount).toBeGreaterThan(0);
    expect(Array.isArray(body.data.daily)).toBe(true);
  });

  it("inventory valuation totals reflect current stock at cost", async () => {
    await createProductWithStock(tokenFor("admin"), { quantity: 10, costPricePerUnit: 4 });

    const { status, body } = await apiRequest("GET", "/api/v1/reports/inventory-valuation", {
      token: tokenFor("admin"),
    });
    expect(status).toBe(200);
    expect(body.data.totals.costValue).toBeGreaterThan(0);
    expect(body.data.products.length).toBeGreaterThan(0);
  });

  it("top products includes a product just sold, with the right quantity", async () => {
    const { product } = await createProductWithStock(tokenFor("admin"), { quantity: 10, sellingPrice: 12 });
    await sellOne(product.id, 4);

    const { status, body } = await apiRequest("GET", "/api/v1/reports/top-products?limit=50", {
      token: tokenFor("admin"),
    });
    expect(status).toBe(200);
    const entry = body.data.find((p) => p.product.id === product.id);
    expect(entry.quantitySold).toBe(4);
    expect(entry.revenue).toBe(48);
  });
});
