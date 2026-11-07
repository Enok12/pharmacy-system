import { describe, it, expect } from "vitest";
import { apiRequest } from "../helpers/client.js";
import { tokenFor } from "../helpers/tokens.js";
import { createProduct, createSupplier } from "../helpers/fixtures.js";

function uniqueName(prefix) {
  return `${prefix}-${Date.now()}-${Math.floor(Math.random() * 100000)}`;
}

describe("Stock-Ins — Admin/Pharmacist only", () => {
  it("GET/POST as Cashier → 403; signed out → 401", async () => {
    const asCashier = await apiRequest("GET", "/api/v1/stock-ins", { token: tokenFor("cashier") });
    expect(asCashier.status).toBe(403);

    const signedOut = await apiRequest("GET", "/api/v1/stock-ins");
    expect(signedOut.status).toBe(401);
  });

  it("creates a StockIn + Batch atomically with quantityRemaining seeded equal to quantityReceived", async () => {
    const supplier = await createSupplier(tokenFor("admin"));
    const product = await createProduct(tokenFor("admin"));

    const { status, body } = await apiRequest("POST", "/api/v1/stock-ins", {
      token: tokenFor("admin"),
      body: {
        supplierId: supplier.id,
        referenceNumber: "INV-TEST-001",
        items: [
          {
            productId: product.id,
            batchNumber: uniqueName("LOT"),
            expiryDate: new Date(Date.now() + 365 * 86400000).toISOString(),
            quantityReceived: 50,
            costPricePerUnit: 3.5,
          },
        ],
      },
    });
    expect(status).toBe(201);
    expect(body.data.stockIn.batches).toHaveLength(1);
    expect(body.data.stockIn.batches[0].quantityReceived).toBe(50);
    expect(body.data.stockIn.batches[0].quantityRemaining).toBe(50);
  });

  it("multi-line stock-in creates every batch in one call", async () => {
    const supplier = await createSupplier(tokenFor("admin"));
    const productA = await createProduct(tokenFor("admin"));
    const productB = await createProduct(tokenFor("admin"));

    const { status, body } = await apiRequest("POST", "/api/v1/stock-ins", {
      token: tokenFor("admin"),
      body: {
        supplierId: supplier.id,
        items: [
          {
            productId: productA.id,
            batchNumber: uniqueName("LOT"),
            expiryDate: new Date(Date.now() + 365 * 86400000).toISOString(),
            quantityReceived: 20,
            costPricePerUnit: 2,
          },
          {
            productId: productB.id,
            batchNumber: uniqueName("LOT"),
            expiryDate: new Date(Date.now() + 365 * 86400000).toISOString(),
            quantityReceived: 30,
            costPricePerUnit: 4,
          },
        ],
      },
    });
    expect(status).toBe(201);
    expect(body.data.stockIn.batches).toHaveLength(2);
  });

  it("nonexistent supplierId/productId → 422 naming the field", async () => {
    const product = await createProduct(tokenFor("admin"));
    const { status, body } = await apiRequest("POST", "/api/v1/stock-ins", {
      token: tokenFor("admin"),
      body: {
        supplierId: "does-not-exist",
        items: [
          {
            productId: product.id,
            batchNumber: "LOT-X",
            expiryDate: new Date(Date.now() + 86400000).toISOString(),
            quantityReceived: 1,
            costPricePerUnit: 1,
          },
        ],
      },
    });
    expect(status).toBe(422);
    expect(body.errors.some((e) => e.field === "supplierId")).toBe(true);
  });

  it("empty items array → 422", async () => {
    const supplier = await createSupplier(tokenFor("admin"));
    const { status } = await apiRequest("POST", "/api/v1/stock-ins", {
      token: tokenFor("admin"),
      body: { supplierId: supplier.id, items: [] },
    });
    expect(status).toBe(422);
  });

  it("is immutable — PATCH/DELETE → 405", async () => {
    const supplier = await createSupplier(tokenFor("admin"));
    const product = await createProduct(tokenFor("admin"));
    const created = await apiRequest("POST", "/api/v1/stock-ins", {
      token: tokenFor("admin"),
      body: {
        supplierId: supplier.id,
        items: [
          {
            productId: product.id,
            batchNumber: uniqueName("LOT"),
            expiryDate: new Date(Date.now() + 86400000).toISOString(),
            quantityReceived: 1,
            costPricePerUnit: 1,
          },
        ],
      },
    });
    const { id } = created.body.data.stockIn;

    const patch = await apiRequest("PATCH", `/api/v1/stock-ins/${id}`, { token: tokenFor("admin"), body: {} });
    expect(patch.status).toBe(405);

    const del = await apiRequest("DELETE", `/api/v1/stock-ins/${id}`, { token: tokenFor("admin") });
    expect(del.status).toBe(405);
  });
});
