import { describe, it, expect } from "vitest";
import { apiRequest } from "../helpers/client.js";
import { tokenFor } from "../helpers/tokens.js";

describe("Users — Admin only", () => {
  it("GET signed out → 401; as Cashier/Pharmacist → 403; as Admin → 200", async () => {
    const signedOut = await apiRequest("GET", "/api/v1/users");
    expect(signedOut.status).toBe(401);

    const asCashier = await apiRequest("GET", "/api/v1/users", { token: tokenFor("cashier") });
    expect(asCashier.status).toBe(403);

    const asPharmacist = await apiRequest("GET", "/api/v1/users", { token: tokenFor("pharmacist") });
    expect(asPharmacist.status).toBe(403);

    const asAdmin = await apiRequest("GET", "/api/v1/users", { token: tokenFor("admin") });
    expect(asAdmin.status).toBe(200);
    expect(Array.isArray(asAdmin.body.data.users)).toBe(true);
  });

  it("POST as Admin creates a user with a chosen role, and that user can log in", async () => {
    const email = `new-user-${Date.now()}@medcare.local`;
    const created = await apiRequest("POST", "/api/v1/users", {
      token: tokenFor("admin"),
      body: { name: "Freshly Created", email, password: "FreshPass123", role: "PHARMACIST" },
    });
    expect(created.status).toBe(201);
    expect(created.body.data.user.role).toBe("PHARMACIST");

    // Synthetic IP — isolates this login from every other file's rate-limit
    // bucket (Next auto-populates x-forwarded-for for local connections;
    // see auth.test.js for the fuller explanation).
    const login = await apiRequest("POST", "/api/v1/auth/login", {
      headers: { "X-Forwarded-For": "198.51.100.11" },
      clientType: "mobile",
      body: { email, password: "FreshPass123" },
    });
    expect(login.status).toBe(200);
  });

  it("password under 8 chars → 422", async () => {
    const { status } = await apiRequest("POST", "/api/v1/users", {
      token: tokenFor("admin"),
      body: { name: "Weak Pw", email: `weak-${Date.now()}@medcare.local`, password: "short", role: "CASHIER" },
    });
    expect(status).toBe(422);
  });

  it("duplicate email → 409", async () => {
    const email = `dup-user-${Date.now()}@medcare.local`;
    await apiRequest("POST", "/api/v1/users", {
      token: tokenFor("admin"),
      body: { name: "First", email, password: "Password123", role: "CASHIER" },
    });
    const dup = await apiRequest("POST", "/api/v1/users", {
      token: tokenFor("admin"),
      body: { name: "Second", email, password: "Password123", role: "CASHIER" },
    });
    expect(dup.status).toBe(409);
  });

  it("POST as non-Admin → 403", async () => {
    const { status } = await apiRequest("POST", "/api/v1/users", {
      token: tokenFor("pharmacist"),
      body: { name: "Nope", email: `nope-${Date.now()}@medcare.local`, password: "Password123", role: "CASHIER" },
    });
    expect(status).toBe(403);
  });
});
