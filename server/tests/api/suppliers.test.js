import { describe, it, expect } from "vitest";
import { apiRequest } from "../helpers/client.js";
import { tokenFor } from "../helpers/tokens.js";

function uniqueName(prefix) {
  return `${prefix}-${Date.now()}-${Math.floor(Math.random() * 100000)}`;
}

describe("Suppliers — Admin/Pharmacist only, no Cashier access at all", () => {
  it("GET as Cashier → 403 (not 200 — unlike Products); signed out → 401", async () => {
    const asCashier = await apiRequest("GET", "/api/v1/suppliers", { token: tokenFor("cashier") });
    expect(asCashier.status).toBe(403);

    const signedOut = await apiRequest("GET", "/api/v1/suppliers");
    expect(signedOut.status).toBe(401);
  });

  it("GET as Admin → 200", async () => {
    const { status, body } = await apiRequest("GET", "/api/v1/suppliers", { token: tokenFor("admin") });
    expect(status).toBe(200);
    expect(Array.isArray(body.data.suppliers)).toBe(true);
  });

  it("POST as Cashier → 403; as Admin → 201", async () => {
    const asCashier = await apiRequest("POST", "/api/v1/suppliers", {
      token: tokenFor("cashier"),
      body: { name: uniqueName("Supplier") },
    });
    expect(asCashier.status).toBe(403);

    const asAdmin = await apiRequest("POST", "/api/v1/suppliers", {
      token: tokenFor("admin"),
      body: { name: uniqueName("Supplier"), contactPerson: "Jane Doe", phone: "555-0100" },
    });
    expect(asAdmin.status).toBe(201);
  });

  it("missing name → 422; duplicate name → 409", async () => {
    const missing = await apiRequest("POST", "/api/v1/suppliers", { token: tokenFor("admin"), body: {} });
    expect(missing.status).toBe(422);

    const name = uniqueName("Dup");
    await apiRequest("POST", "/api/v1/suppliers", { token: tokenFor("admin"), body: { name } });
    const dup = await apiRequest("POST", "/api/v1/suppliers", { token: tokenFor("admin"), body: { name } });
    expect(dup.status).toBe(409);
  });

  it("PATCH deactivate/reactivate", async () => {
    const created = await apiRequest("POST", "/api/v1/suppliers", {
      token: tokenFor("admin"),
      body: { name: uniqueName("Toggle") },
    });
    const { id } = created.body.data.supplier;

    const deactivated = await apiRequest("PATCH", `/api/v1/suppliers/${id}`, {
      token: tokenFor("admin"),
      body: { isActive: false },
    });
    expect(deactivated.body.data.supplier.isActive).toBe(false);
  });
});
