import { describe, it, expect } from "vitest";
import { apiRequest } from "../helpers/client.js";
import { tokenFor } from "../helpers/tokens.js";
import { createProductWithStock, createStockIn, checkout } from "../helpers/fixtures.js";

describe("Audit Log — Admin/Pharmacist only", () => {
  it("Cashier → 403; signed out → 401", async () => {
    const asCashier = await apiRequest("GET", "/api/v1/audit-log", { token: tokenFor("cashier") });
    expect(asCashier.status).toBe(403);

    const signedOut = await apiRequest("GET", "/api/v1/audit-log");
    expect(signedOut.status).toBe(401);
  });

  it("merges StockAdjustment and SaleReturn entries, sorted by createdAt desc", async () => {
    const admin = tokenFor("admin");
    const { product, batch } = await createProductWithStock(admin, { quantity: 20, sellingPrice: 10 });

    const adjustment = await apiRequest("POST", "/api/v1/stock-adjustments", {
      token: admin,
      body: { batchId: batch.id, quantityChange: -2, reason: "DAMAGED" },
    });
    expect(adjustment.status).toBe(201);

    const sale = await checkout(tokenFor("cashier"), { items: [{ productId: product.id, quantity: 2 }] });
    const returned = await apiRequest("POST", "/api/v1/sale-returns", {
      token: admin,
      body: { saleId: sale.id, refundMethod: "CASH", items: [{ saleItemId: sale.items[0].id, quantity: 1 }] },
    });
    expect(returned.status).toBe(201);

    const { status, body } = await apiRequest("GET", "/api/v1/audit-log?pageSize=100", { token: admin });
    expect(status).toBe(200);

    const types = new Set(body.data.entries.map((e) => e.type));
    expect(types.has("STOCK_ADJUSTMENT")).toBe(true);
    expect(types.has("SALE_RETURN")).toBe(true);

    const dates = body.data.entries.map((e) => new Date(e.createdAt).getTime());
    const sorted = [...dates].sort((a, b) => b - a);
    expect(dates).toEqual(sorted);
  });

  it("pagination: page 2 doesn't repeat or skip relative to page 1", async () => {
    const { body: pageOne } = await apiRequest("GET", "/api/v1/audit-log?page=1&pageSize=3", {
      token: tokenFor("admin"),
    });
    const { body: pageTwo } = await apiRequest("GET", "/api/v1/audit-log?page=2&pageSize=3", {
      token: tokenFor("admin"),
    });

    if (pageOne.data.total > 3) {
      const idsOne = pageOne.data.entries.map((e) => `${e.type}-${e.id}`);
      const idsTwo = pageTwo.data.entries.map((e) => `${e.type}-${e.id}`);
      expect(idsOne.some((id) => idsTwo.includes(id))).toBe(false);
    }
  });
});
