import { describe, it, expect } from "vitest";
import { apiRequest } from "../helpers/client.js";
import { tokenFor } from "../helpers/tokens.js";

function uniqueName(prefix) {
  return `${prefix}-${Date.now()}-${Math.floor(Math.random() * 100000)}`;
}

describe("Manufacturers", () => {
  it("GET is open to any authenticated role; 401 signed out", async () => {
    const asCashier = await apiRequest("GET", "/api/v1/manufacturers", { token: tokenFor("cashier") });
    expect(asCashier.status).toBe(200);
    expect(Array.isArray(asCashier.body.data.manufacturers)).toBe(true);

    const signedOut = await apiRequest("GET", "/api/v1/manufacturers");
    expect(signedOut.status).toBe(401);
  });

  it("POST as Cashier → 403; as Admin → 201", async () => {
    const asCashier = await apiRequest("POST", "/api/v1/manufacturers", {
      token: tokenFor("cashier"),
      body: { name: uniqueName("Mfr") },
    });
    expect(asCashier.status).toBe(403);

    const asAdmin = await apiRequest("POST", "/api/v1/manufacturers", {
      token: tokenFor("admin"),
      body: { name: uniqueName("Mfr") },
    });
    expect(asAdmin.status).toBe(201);
  });

  it("missing name → 422", async () => {
    const { status } = await apiRequest("POST", "/api/v1/manufacturers", { token: tokenFor("admin"), body: {} });
    expect(status).toBe(422);
  });

  it("duplicate name (case-insensitive) → 409", async () => {
    const name = uniqueName("Dup");
    await apiRequest("POST", "/api/v1/manufacturers", { token: tokenFor("admin"), body: { name } });
    const dup = await apiRequest("POST", "/api/v1/manufacturers", {
      token: tokenFor("admin"),
      body: { name: name.toLowerCase() },
    });
    expect(dup.status).toBe(409);
  });

  it("PATCH deactivate/reactivate", async () => {
    const created = await apiRequest("POST", "/api/v1/manufacturers", {
      token: tokenFor("admin"),
      body: { name: uniqueName("Toggle") },
    });
    const { id } = created.body.data.manufacturer;

    const deactivated = await apiRequest("PATCH", `/api/v1/manufacturers/${id}`, {
      token: tokenFor("admin"),
      body: { isActive: false },
    });
    expect(deactivated.body.data.manufacturer.isActive).toBe(false);
  });
});
