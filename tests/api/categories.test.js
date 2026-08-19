import { describe, it, expect } from "vitest";
import { apiRequest } from "../helpers/client.js";
import { tokenFor } from "../helpers/tokens.js";

function uniqueName(prefix) {
  return `${prefix}-${Date.now()}-${Math.floor(Math.random() * 100000)}`;
}

describe("Categories", () => {
  it("GET is open to any authenticated role; 401 signed out", async () => {
    const asCashier = await apiRequest("GET", "/api/v1/categories", { token: tokenFor("cashier") });
    expect(asCashier.status).toBe(200);
    expect(Array.isArray(asCashier.body.data.categories)).toBe(true);

    const signedOut = await apiRequest("GET", "/api/v1/categories");
    expect(signedOut.status).toBe(401);
  });

  it("POST as Cashier → 403; as Pharmacist/Admin → 201", async () => {
    const asCashier = await apiRequest("POST", "/api/v1/categories", {
      token: tokenFor("cashier"),
      body: { name: uniqueName("Cat") },
    });
    expect(asCashier.status).toBe(403);

    const asAdmin = await apiRequest("POST", "/api/v1/categories", {
      token: tokenFor("admin"),
      body: { name: uniqueName("Cat") },
    });
    expect(asAdmin.status).toBe(201);
    expect(asAdmin.body.data.category.name).toBeTruthy();
  });

  it("missing name → 422", async () => {
    const { status, body } = await apiRequest("POST", "/api/v1/categories", {
      token: tokenFor("admin"),
      body: {},
    });
    expect(status).toBe(422);
    expect(body.errors.length).toBeGreaterThan(0);
  });

  it("duplicate name (case-insensitive) → 409", async () => {
    const name = uniqueName("Dup");
    const first = await apiRequest("POST", "/api/v1/categories", { token: tokenFor("admin"), body: { name } });
    expect(first.status).toBe(201);

    const dup = await apiRequest("POST", "/api/v1/categories", {
      token: tokenFor("admin"),
      body: { name: name.toUpperCase() },
    });
    expect(dup.status).toBe(409);
  });

  it("PATCH isActive:false removes it from the default list, reactivating brings it back", async () => {
    const created = await apiRequest("POST", "/api/v1/categories", {
      token: tokenFor("admin"),
      body: { name: uniqueName("Toggle") },
    });
    const { id } = created.body.data.category;

    const deactivate = await apiRequest("PATCH", `/api/v1/categories/${id}`, {
      token: tokenFor("admin"),
      body: { isActive: false },
    });
    expect(deactivate.status).toBe(200);
    expect(deactivate.body.data.category.isActive).toBe(false);

    const list = await apiRequest("GET", "/api/v1/categories?isActive=true", { token: tokenFor("admin") });
    expect(list.body.data.categories.find((c) => c.id === id)).toBeUndefined();

    const reactivate = await apiRequest("PATCH", `/api/v1/categories/${id}`, {
      token: tokenFor("admin"),
      body: { isActive: true },
    });
    expect(reactivate.body.data.category.isActive).toBe(true);
  });
});
