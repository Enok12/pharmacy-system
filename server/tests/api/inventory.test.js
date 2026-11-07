import { describe, it, expect } from "vitest";
import { apiRequest } from "../helpers/client.js";
import { tokenFor } from "../helpers/tokens.js";
import { createProduct, createStockIn, createProductWithStock } from "../helpers/fixtures.js";

describe("Inventory — any role, read-only", () => {
  it("GET is open to Cashier (fully open resource, like Products); 401 signed out", async () => {
    const asCashier = await apiRequest("GET", "/api/v1/inventory", { token: tokenFor("cashier") });
    expect(asCashier.status).toBe(200);

    const signedOut = await apiRequest("GET", "/api/v1/inventory");
    expect(signedOut.status).toBe(401);
  });

  it("totalRemaining sums quantityRemaining across all of a product's batches", async () => {
    const admin = tokenFor("admin");
    const product = await createProduct(admin);
    await createStockIn(admin, { productId: product.id, quantity: 30 });
    await createStockIn(admin, { productId: product.id, quantity: 45 });

    const { body } = await apiRequest("GET", `/api/v1/inventory?search=${encodeURIComponent(product.name)}`, {
      token: admin,
    });
    const entry = body.data.products.find((p) => p.id === product.id);
    expect(entry.totalRemaining).toBe(75);
  });

  it("?stockStatus=OUT filters to only products with zero remaining stock", async () => {
    const { body } = await apiRequest("GET", "/api/v1/inventory?stockStatus=OUT&pageSize=100", {
      token: tokenFor("admin"),
    });
    expect(body.data.products.every((p) => p.stockStatus === "OUT")).toBe(true);
  });

  it("batches are returned in FEFO order (soonest expiry first) with computed status", async () => {
    const admin = tokenFor("admin");
    const product = await createProduct(admin);
    const later = new Date(Date.now() + 300 * 86400000).toISOString();
    // Beyond the app's 30-day EXPIRING_SOON_DAYS window (services/inventory.service.js)
    // so this batch's computed status is genuinely "OK", not "EXPIRING_SOON".
    const sooner = new Date(Date.now() + 60 * 86400000).toISOString();
    await createStockIn(admin, { productId: product.id, quantity: 10, expiryDate: later });
    await createStockIn(admin, { productId: product.id, quantity: 10, expiryDate: sooner });

    const { status, body } = await apiRequest("GET", `/api/v1/inventory/products/${product.id}/batches`, {
      token: admin,
    });
    expect(status).toBe(200);
    expect(body.data.batches).toHaveLength(2);
    expect(new Date(body.data.batches[0].expiryDate).getTime()).toBeLessThan(
      new Date(body.data.batches[1].expiryDate).getTime()
    );
    expect(body.data.batches[0].status).toBe("OK");
  });

  it("nonexistent product id → 404", async () => {
    const { status } = await apiRequest("GET", "/api/v1/inventory/products/does-not-exist/batches", {
      token: tokenFor("admin"),
    });
    expect(status).toBe(404);
  });

  describe("FEFO allocation preview", () => {
    it("allocates from the soonest-expiring batch first, splitting across batches as needed", async () => {
      const admin = tokenFor("admin");
      const product = await createProduct(admin);
      const later = new Date(Date.now() + 300 * 86400000).toISOString();
      const sooner = new Date(Date.now() + 10 * 86400000).toISOString();
      await createStockIn(admin, { productId: product.id, quantity: 20, expiryDate: later });
      const soonerStockIn = await createStockIn(admin, { productId: product.id, quantity: 15, expiryDate: sooner });

      const { status, body } = await apiRequest(
        "GET",
        `/api/v1/inventory/products/${product.id}/fefo?quantity=25`,
        { token: admin }
      );
      expect(status).toBe(200);
      expect(body.data.allocation.sufficient).toBe(true);
      expect(body.data.allocation.allocations[0].batchId).toBe(soonerStockIn.batches[0].id);
      expect(body.data.allocation.allocations[0].quantityToTake).toBe(15);
      expect(body.data.allocation.allocations[1].quantityToTake).toBe(10);
    });

    it("requesting more than total remaining → sufficient:false with a partial allocation, not an error", async () => {
      const { product } = await createProductWithStock(tokenFor("admin"), { quantity: 5 });

      const { status, body } = await apiRequest(
        "GET",
        `/api/v1/inventory/products/${product.id}/fefo?quantity=999999`,
        { token: tokenFor("admin") }
      );
      expect(status).toBe(200);
      expect(body.data.allocation.sufficient).toBe(false);
      expect(body.data.allocation.totalAllocated).toBe(5);
    });

    it("quantity=0 or missing → 422", async () => {
      const { product } = await createProductWithStock(tokenFor("admin"));
      const missing = await apiRequest("GET", `/api/v1/inventory/products/${product.id}/fefo`, {
        token: tokenFor("admin"),
      });
      expect(missing.status).toBe(422);

      const zero = await apiRequest("GET", `/api/v1/inventory/products/${product.id}/fefo?quantity=0`, {
        token: tokenFor("admin"),
      });
      expect(zero.status).toBe(422);
    });
  });
});
