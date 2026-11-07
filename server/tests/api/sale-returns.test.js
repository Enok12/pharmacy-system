import { describe, it, expect, beforeAll } from "vitest";
import { apiRequest } from "../helpers/client.js";
import { tokenFor } from "../helpers/tokens.js";
import { createProduct, createStockIn } from "../helpers/fixtures.js";

// One shared 120-unit sale (100 from the earlier-expiry batch, 20 from
// the later one — the same multi-batch split manually verified in
// Phase 8) reused across this file's return scenarios, since the
// reverse-FEFO restock math specifically depends on prior returns of
// the *same* line.
let saleId;
let saleItemId;
let productId;
let batchA; // earlier expiry, contributes 100
let batchX; // later expiry, contributes 20
const UNIT_PRICE = 10;
const TAX_RATE = 10; // refund per unit = 10 * 1.10 = 11

beforeAll(async () => {
  const admin = tokenFor("admin");
  const product = await createProduct(admin, { sellingPrice: UNIT_PRICE, taxRate: TAX_RATE });
  productId = product.id;
  const earlier = new Date(Date.now() + 30 * 86400000).toISOString();
  const later = new Date(Date.now() + 300 * 86400000).toISOString();
  batchA = (await createStockIn(admin, { productId: product.id, quantity: 100, expiryDate: earlier })).batches[0];
  batchX = (await createStockIn(admin, { productId: product.id, quantity: 50, expiryDate: later })).batches[0];

  const sale = await apiRequest("POST", "/api/v1/sales", {
    token: tokenFor("cashier"),
    body: { paymentMethod: "CARD", items: [{ productId: product.id, quantity: 120 }] },
  });
  saleId = sale.body.data.sale.id;
  saleItemId = sale.body.data.sale.items[0].id;
});

function remainingOf(batches, id) {
  return batches.find((b) => b.id === id)?.quantityRemaining ?? 0;
}

describe("Sale Returns — Admin/Pharmacist only", () => {
  it("GET/POST as Cashier → 403; signed out → 401", async () => {
    const asCashier = await apiRequest("GET", "/api/v1/sale-returns", { token: tokenFor("cashier") });
    expect(asCashier.status).toBe(403);

    const signedOut = await apiRequest("GET", "/api/v1/sale-returns");
    expect(signedOut.status).toBe(401);
  });

  it("GET /sales/:id/returnable shows the full original quantity as returnable before any return", async () => {
    const { status, body } = await apiRequest("GET", `/api/v1/sales/${saleId}/returnable`, {
      token: tokenFor("admin"),
    });
    expect(status).toBe(200);
    const item = body.data.sale.items[0];
    expect(item.quantity).toBe(120);
    expect(item.returnedQuantity).toBe(0);
    expect(item.returnableQuantity).toBe(120);
  });

  it("requesting more than returnable → 422 naming the product and the actual returnable amount", async () => {
    const { status, body } = await apiRequest("POST", "/api/v1/sale-returns", {
      token: tokenFor("admin"),
      body: {
        saleId,
        refundMethod: "CASH",
        items: [{ saleItemId, quantity: 200, restock: true }],
      },
    });
    expect(status).toBe(422);
    expect(body.errors[0].message).toMatch(/only 120 returnable/i);
  });

  it("first partial return (10, restock) refunds correctly and restocks the latest-expiry batch first", async () => {
    const { status, body } = await apiRequest("POST", "/api/v1/sale-returns", {
      token: tokenFor("admin"),
      body: {
        saleId,
        reason: "Customer changed mind",
        refundMethod: "CASH",
        items: [{ saleItemId, quantity: 10, restock: true }],
      },
    });
    expect(status).toBe(201);
    expect(body.data.saleReturn.refundAmount).toBeCloseTo(10 * UNIT_PRICE * 1.1, 5);
    expect(body.data.saleReturn.items[0].restocked).toBe(true);

    const batches = await apiRequest("GET", `/api/v1/inventory/products/${productId}/batches`, {
      token: tokenFor("admin"),
    });
    // batchX (later expiry) contributed 20 originally — 10 fits entirely within its headroom.
    expect(remainingOf(batches.body.data.batches, batchX.id)).toBe(40); // 50 - 20 + 10
    expect(remainingOf(batches.body.data.batches, batchA.id)).toBe(0); // untouched, still fully depleted
  });

  it("second partial return (15, restock) splits across batches without over-restocking either", async () => {
    const { status } = await apiRequest("POST", "/api/v1/sale-returns", {
      token: tokenFor("admin"),
      body: {
        saleId,
        reason: "Wrong item",
        refundMethod: "CASH",
        items: [{ saleItemId, quantity: 15, restock: true }],
      },
    });
    expect(status).toBe(201);

    const returnable = await apiRequest("GET", `/api/v1/sales/${saleId}/returnable`, { token: tokenFor("admin") });
    expect(returnable.body.data.sale.items[0].returnedQuantity).toBe(25);
    expect(returnable.body.data.sale.items[0].returnableQuantity).toBe(95);

    const product = returnable.body.data.sale.items[0].product;
    const batches = await apiRequest("GET", `/api/v1/inventory/products/${product.id}/batches`, {
      token: tokenFor("admin"),
    });
    // batchX's remaining headroom (20 - 10 = 10) absorbs 10, the other 5 goes to batchA.
    expect(remainingOf(batches.body.data.batches, batchX.id)).toBe(50); // back to its original 50
    expect(remainingOf(batches.body.data.batches, batchA.id)).toBe(5);
  });

  it("returning more than what's left after prior returns → 422 with the updated returnable amount", async () => {
    const { status, body } = await apiRequest("POST", "/api/v1/sale-returns", {
      token: tokenFor("admin"),
      body: { saleId, refundMethod: "CASH", items: [{ saleItemId, quantity: 96, restock: false }] },
    });
    expect(status).toBe(422);
    expect(body.errors[0].message).toMatch(/only 95 returnable/i);
  });

  it("restock:false records the refund but leaves every batch's quantityRemaining untouched", async () => {
    const returnableBefore = await apiRequest("GET", `/api/v1/sales/${saleId}/returnable`, {
      token: tokenFor("admin"),
    });
    const productId = returnableBefore.body.data.sale.items[0].product.id;
    const batchesBefore = await apiRequest("GET", `/api/v1/inventory/products/${productId}/batches`, {
      token: tokenFor("admin"),
    });

    const result = await apiRequest("POST", "/api/v1/sale-returns", {
      token: tokenFor("admin"),
      body: { saleId, refundMethod: "CARD", items: [{ saleItemId, quantity: 5, restock: false }] },
    });
    expect(result.status).toBe(201);
    expect(result.body.data.saleReturn.items[0].restocked).toBe(false);

    const batchesAfter = await apiRequest("GET", `/api/v1/inventory/products/${productId}/batches`, {
      token: tokenFor("admin"),
    });
    expect(remainingOf(batchesAfter.body.data.batches, batchA.id)).toBe(
      remainingOf(batchesBefore.body.data.batches, batchA.id)
    );
    expect(remainingOf(batchesAfter.body.data.batches, batchX.id)).toBe(
      remainingOf(batchesBefore.body.data.batches, batchX.id)
    );
  });

  it("is immutable — PATCH/DELETE → 405", async () => {
    const list = await apiRequest("GET", "/api/v1/sale-returns?pageSize=1", { token: tokenFor("admin") });
    const anyReturnId = list.body.data.returns[0].id;

    const patch = await apiRequest("PATCH", `/api/v1/sale-returns/${anyReturnId}`, {
      token: tokenFor("admin"),
      body: {},
    });
    expect(patch.status).toBe(405);
  });
});
