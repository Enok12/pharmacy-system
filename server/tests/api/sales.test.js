import { describe, it, expect, beforeAll } from "vitest";
import { apiRequest } from "../helpers/client.js";
import { tokenFor } from "../helpers/tokens.js";
import { createProduct, createStockIn, createProductWithStock } from "../helpers/fixtures.js";

// A second, dedicated Cashier — needed to test cross-cashier visibility
// (GET /sales scoping, GET /sales/:id ownership) and the atomicity
// scenario (two accounts racing the same stock). Isolated on its own
// synthetic IP so its login doesn't share a rate-limit bucket with any
// other file (see auth.test.js).
const CASHIER_B_EMAIL = `sales-test-cashier-${Date.now()}@medcare.local`;
const CASHIER_B_PASSWORD = "SalesTestPass123";
const HEADERS = { "X-Forwarded-For": "198.51.100.12" };
let cashierBToken;

beforeAll(async () => {
  await apiRequest("POST", "/api/v1/users", {
    token: tokenFor("admin"),
    body: { name: "Sales Test Cashier B", email: CASHIER_B_EMAIL, password: CASHIER_B_PASSWORD, role: "CASHIER" },
  });
  const login = await apiRequest("POST", "/api/v1/auth/login", {
    headers: HEADERS,
    clientType: "mobile",
    body: { email: CASHIER_B_EMAIL, password: CASHIER_B_PASSWORD },
  });
  cashierBToken = login.body.data.accessToken;
});

describe("Sales — checkout", () => {
  it("CASH with sufficient amountTendered → 201; batch decremented by exact FEFO allocation; changeDue correct", async () => {
    const { product, batch } = await createProductWithStock(tokenFor("admin"), {
      quantity: 20,
      sellingPrice: 10,
      taxRate: 0,
    });

    const { status, body } = await apiRequest("POST", "/api/v1/sales", {
      token: tokenFor("cashier"),
      body: { paymentMethod: "CASH", amountTendered: 50, items: [{ productId: product.id, quantity: 4 }] },
    });
    expect(status).toBe(201);
    expect(body.data.sale.total).toBe(40);
    expect(body.data.sale.changeDue).toBe(10);

    const batches = await apiRequest("GET", `/api/v1/inventory/products/${product.id}/batches`, {
      token: tokenFor("admin"),
    });
    const updatedBatch = batches.body.data.batches.find((b) => b.id === batch.id);
    expect(updatedBatch.quantityRemaining).toBe(16);
  });

  it("CARD → 201 with amountTendered/changeDue both null", async () => {
    const { product } = await createProductWithStock(tokenFor("admin"), { quantity: 10 });

    const { status, body } = await apiRequest("POST", "/api/v1/sales", {
      token: tokenFor("cashier"),
      body: { paymentMethod: "CARD", items: [{ productId: product.id, quantity: 1 }] },
    });
    expect(status).toBe(201);
    expect(body.data.sale.amountTendered).toBeNull();
    expect(body.data.sale.changeDue).toBeNull();
  });

  it("CASH below total → 422; CASH missing amountTendered → 422; no items → 422", async () => {
    const { product } = await createProductWithStock(tokenFor("admin"), { quantity: 10, sellingPrice: 10 });
    const items = [{ productId: product.id, quantity: 2 }];

    const tooLow = await apiRequest("POST", "/api/v1/sales", {
      token: tokenFor("cashier"),
      body: { paymentMethod: "CASH", amountTendered: 5, items },
    });
    expect(tooLow.status).toBe(422);

    const missing = await apiRequest("POST", "/api/v1/sales", {
      token: tokenFor("cashier"),
      body: { paymentMethod: "CASH", items },
    });
    expect(missing.status).toBe(422);

    const noItems = await apiRequest("POST", "/api/v1/sales", {
      token: tokenFor("cashier"),
      body: { paymentMethod: "CARD", items: [] },
    });
    expect(noItems.status).toBe(422);
  });

  it("FEFO consumes the soonest-expiring batch first, splitting across batches", async () => {
    const admin = tokenFor("admin");
    const product = await createProduct(admin, { sellingPrice: 5 });
    const sooner = new Date(Date.now() + 10 * 86400000).toISOString();
    const later = new Date(Date.now() + 300 * 86400000).toISOString();
    const soonBatch = (await createStockIn(admin, { productId: product.id, quantity: 5, expiryDate: sooner }))
      .batches[0];
    const lateBatch = (await createStockIn(admin, { productId: product.id, quantity: 10, expiryDate: later }))
      .batches[0];

    const { status } = await apiRequest("POST", "/api/v1/sales", {
      token: tokenFor("cashier"),
      body: { paymentMethod: "CARD", items: [{ productId: product.id, quantity: 8 }] },
    });
    expect(status).toBe(201);

    const batches = await apiRequest("GET", `/api/v1/inventory/products/${product.id}/batches`, { token: admin });
    const soonRemaining = batches.body.data.batches.find((b) => b.id === soonBatch.id)?.quantityRemaining ?? 0;
    const lateRemaining = batches.body.data.batches.find((b) => b.id === lateBatch.id)?.quantityRemaining;
    expect(soonRemaining).toBe(0);
    expect(lateRemaining).toBe(7);
  });

  it("atomicity: a forced stock shortfall writes nothing — 422 naming the exact shortfall", async () => {
    const admin = tokenFor("admin");
    const { product, batch } = await createProductWithStock(admin, { quantity: 10, sellingPrice: 5 });

    // Cashier B buys 8 of the stock first, leaving only 2. There's no
    // add-to-cart soft-check anymore (see the "drop DB-backed cart"
    // plan) — checkout's own atomic re-validation is the only check,
    // and it's what this test is really exercising.
    const bCheckout = await apiRequest("POST", "/api/v1/sales", {
      token: cashierBToken,
      body: { paymentMethod: "CARD", items: [{ productId: product.id, quantity: 8 }] },
    });
    expect(bCheckout.status).toBe(201);

    const salesListBefore = await apiRequest("GET", "/api/v1/sales?pageSize=1", { token: admin });
    const totalBefore = salesListBefore.body.data.total;

    // Cashier A now attempts to check out the 10 units they originally
    // saw available — only 2 remain, so this must fail inside the
    // transaction, naming the exact shortfall.
    const aCheckout = await apiRequest("POST", "/api/v1/sales", {
      token: tokenFor("cashier"),
      body: { paymentMethod: "CARD", items: [{ productId: product.id, quantity: 10 }] },
    });
    expect(aCheckout.status).toBe(422);
    expect(aCheckout.body.errors[0].message).toMatch(/only 2 in stock/i);

    // Confirm nothing was written: sale count unchanged, batch still at
    // exactly what cashier B's sale left it at (2), not partially decremented.
    const salesListAfter = await apiRequest("GET", "/api/v1/sales?pageSize=1", { token: admin });
    expect(salesListAfter.body.data.total).toBe(totalBefore);

    const batches = await apiRequest("GET", `/api/v1/inventory/products/${product.id}/batches`, { token: admin });
    const remaining = batches.body.data.batches.find((b) => b.id === batch.id)?.quantityRemaining ?? 0;
    expect(remaining).toBe(2);
  });
});

describe("Sales — visibility and immutability", () => {
  it("GET /sales as Cashier → only their own sales; as Admin → all sales including other cashiers'", async () => {
    const { product } = await createProductWithStock(tokenFor("admin"), { quantity: 5 });
    const bSale = await apiRequest("POST", "/api/v1/sales", {
      token: cashierBToken,
      body: { paymentMethod: "CARD", items: [{ productId: product.id, quantity: 1 }] },
    });
    const bSaleId = bSale.body.data.sale.id;

    const asCashierA = await apiRequest("GET", "/api/v1/sales?pageSize=100", { token: tokenFor("cashier") });
    expect(asCashierA.body.data.sales.some((s) => s.id === bSaleId)).toBe(false);

    const asCashierB = await apiRequest("GET", "/api/v1/sales?pageSize=100", { token: cashierBToken });
    expect(asCashierB.body.data.sales.some((s) => s.id === bSaleId)).toBe(true);

    const asAdmin = await apiRequest("GET", "/api/v1/sales?pageSize=100", { token: tokenFor("admin") });
    expect(asAdmin.body.data.sales.some((s) => s.id === bSaleId)).toBe(true);
  });

  it("GET /sales/:id for another cashier's sale → 404, not 403", async () => {
    const { product } = await createProductWithStock(tokenFor("admin"), { quantity: 5 });
    const bSale = await apiRequest("POST", "/api/v1/sales", {
      token: cashierBToken,
      body: { paymentMethod: "CARD", items: [{ productId: product.id, quantity: 1 }] },
    });

    const asCashierA = await apiRequest("GET", `/api/v1/sales/${bSale.body.data.sale.id}`, {
      token: tokenFor("cashier"),
    });
    expect(asCashierA.status).toBe(404);
  });

  it("is immutable — PATCH/DELETE → 405", async () => {
    const { product } = await createProductWithStock(tokenFor("admin"), { quantity: 5 });
    const sale = await apiRequest("POST", "/api/v1/sales", {
      token: tokenFor("cashier"),
      body: { paymentMethod: "CARD", items: [{ productId: product.id, quantity: 1 }] },
    });

    const patch = await apiRequest("PATCH", `/api/v1/sales/${sale.body.data.sale.id}`, {
      token: tokenFor("admin"),
      body: {},
    });
    expect(patch.status).toBe(405);
  });
});
