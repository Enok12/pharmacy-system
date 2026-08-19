import { describe, it, expect } from "vitest";
import { apiRequest } from "../helpers/client.js";
import { tokenFor } from "../helpers/tokens.js";
import { createProductWithStock } from "../helpers/fixtures.js";

describe("Stock Adjustments — Admin/Pharmacist only", () => {
  it("GET/POST as Cashier → 403; signed out → 401", async () => {
    const asCashier = await apiRequest("GET", "/api/v1/stock-adjustments", { token: tokenFor("cashier") });
    expect(asCashier.status).toBe(403);

    const signedOut = await apiRequest("GET", "/api/v1/stock-adjustments");
    expect(signedOut.status).toBe(401);
  });

  it("a negative change beyond quantityRemaining → 422", async () => {
    const { batch } = await createProductWithStock(tokenFor("admin"), { quantity: 5 });

    const { status, body } = await apiRequest("POST", "/api/v1/stock-adjustments", {
      token: tokenFor("admin"),
      body: { batchId: batch.id, quantityChange: -50, reason: "DAMAGED" },
    });
    expect(status).toBe(422);
    expect(body.errors[0].message).toMatch(/negative stock/i);
  });

  it("a valid negative adjustment decrements quantityRemaining by exactly that amount", async () => {
    const { product, batch } = await createProductWithStock(tokenFor("admin"), { quantity: 20 });

    const { status, body } = await apiRequest("POST", "/api/v1/stock-adjustments", {
      token: tokenFor("admin"),
      body: { batchId: batch.id, quantityChange: -5, reason: "DAMAGED", notes: "crushed" },
    });
    expect(status).toBe(201);
    expect(body.data.adjustment.quantityChange).toBe(-5);

    const batches = await apiRequest("GET", `/api/v1/inventory/products/${product.id}/batches`, {
      token: tokenFor("admin"),
    });
    expect(batches.body.data.batches.find((b) => b.id === batch.id).quantityRemaining).toBe(15);
  });

  it("a valid positive adjustment increments quantityRemaining by exactly that amount", async () => {
    const { product, batch } = await createProductWithStock(tokenFor("admin"), { quantity: 20 });

    await apiRequest("POST", "/api/v1/stock-adjustments", {
      token: tokenFor("admin"),
      body: { batchId: batch.id, quantityChange: 10, reason: "COUNT_CORRECTION" },
    });

    const batches = await apiRequest("GET", `/api/v1/inventory/products/${product.id}/batches`, {
      token: tokenFor("admin"),
    });
    expect(batches.body.data.batches.find((b) => b.id === batch.id).quantityRemaining).toBe(30);
  });

  it("quantityChange of 0 → 422; nonexistent batchId → 404; invalid reason → 422", async () => {
    const { batch } = await createProductWithStock(tokenFor("admin"), { quantity: 10 });

    const zero = await apiRequest("POST", "/api/v1/stock-adjustments", {
      token: tokenFor("admin"),
      body: { batchId: batch.id, quantityChange: 0, reason: "OTHER" },
    });
    expect(zero.status).toBe(422);

    const badBatch = await apiRequest("POST", "/api/v1/stock-adjustments", {
      token: tokenFor("admin"),
      body: { batchId: "does-not-exist", quantityChange: -1, reason: "OTHER" },
    });
    expect(badBatch.status).toBe(404);

    const badReason = await apiRequest("POST", "/api/v1/stock-adjustments", {
      token: tokenFor("admin"),
      body: { batchId: batch.id, quantityChange: -1, reason: "NOT_A_REAL_REASON" },
    });
    expect(badReason.status).toBe(422);
  });

  it("GET list filters by batchId", async () => {
    const { batch } = await createProductWithStock(tokenFor("admin"), { quantity: 20 });
    await apiRequest("POST", "/api/v1/stock-adjustments", {
      token: tokenFor("admin"),
      body: { batchId: batch.id, quantityChange: -2, reason: "DAMAGED" },
    });

    const { body } = await apiRequest("GET", `/api/v1/stock-adjustments?batchId=${batch.id}`, {
      token: tokenFor("admin"),
    });
    expect(body.data.adjustments.every((a) => a.batch.id === batch.id)).toBe(true);
    expect(body.data.adjustments.length).toBeGreaterThan(0);
  });
});
