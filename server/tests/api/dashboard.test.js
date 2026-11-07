import { describe, it, expect } from "vitest";
import { apiRequest } from "../helpers/client.js";
import { tokenFor } from "../helpers/tokens.js";
import { createProductWithStock, checkout } from "../helpers/fixtures.js";

describe("Dashboard", () => {
  it("GET /stats is role-aware: Cashier gets mySalesToday only; Admin/Pharmacist get store-wide figures", async () => {
    const asCashier = await apiRequest("GET", "/api/v1/dashboard/stats", { token: tokenFor("cashier") });
    expect(asCashier.status).toBe(200);
    expect(asCashier.body.data.mySalesToday).toBeDefined();
    expect(asCashier.body.data.todaysSales).toBeUndefined();

    const asAdmin = await apiRequest("GET", "/api/v1/dashboard/stats", { token: tokenFor("admin") });
    expect(asAdmin.status).toBe(200);
    expect(asAdmin.body.data.todaysSales).toBeDefined();
    expect(asAdmin.body.data.monthRevenue).toBeTypeOf("number");
    expect(asAdmin.body.data.inventoryValue).toBeTypeOf("number");

    const signedOut = await apiRequest("GET", "/api/v1/dashboard/stats");
    expect(signedOut.status).toBe(401);
  });

  it("GET /alerts is open to Cashier (matches Inventory's own openness)", async () => {
    const { status, body } = await apiRequest("GET", "/api/v1/dashboard/alerts", { token: tokenFor("cashier") });
    expect(status).toBe(200);
    expect(Array.isArray(body.data.lowStock)).toBe(true);
    expect(Array.isArray(body.data.expiringSoon)).toBe(true);
  });

  it("GET /sales-trend is Admin/Pharmacist only, and reflects a completed sale in today's bucket", async () => {
    const asCashier = await apiRequest("GET", "/api/v1/dashboard/sales-trend", { token: tokenFor("cashier") });
    expect(asCashier.status).toBe(403);

    const { product } = await createProductWithStock(tokenFor("admin"), { quantity: 10, sellingPrice: 20 });
    await checkout(tokenFor("cashier"), { items: [{ productId: product.id, quantity: 2 }] });

    const { status, body } = await apiRequest("GET", "/api/v1/dashboard/sales-trend?days=7", {
      token: tokenFor("admin"),
    });
    expect(status).toBe(200);
    expect(Array.isArray(body.data)).toBe(true);
    expect(body.data).toHaveLength(7);
    const today = body.data[body.data.length - 1];
    expect(today.revenue).toBeGreaterThan(0);
    expect(today.salesCount).toBeGreaterThan(0);
  });
});
