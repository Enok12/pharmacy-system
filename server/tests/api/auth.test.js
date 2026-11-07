import { describe, it, expect, beforeAll } from "vitest";
import { apiRequest, baseUrl } from "../helpers/client.js";
import { tokenFor } from "../helpers/tokens.js";

// Dedicated test user for login/refresh/logout — deliberately NOT the
// shared admin/pharmacist/cashier tokens from global-setup, since
// refresh/logout rotate and revoke tokens and every other test file
// reuses those shared tokens for the whole run.
const EMAIL = `auth-test-${Date.now()}@medcare.local`;
const PASSWORD = "AuthTestPass123";

// Next's dev server auto-populates x-forwarded-for from the real socket
// peer for local connections, so every test file's login/refresh/logout
// calls would otherwise land in the SAME rate-limit bucket (Phase 11) —
// this file alone makes 7 of them, which would already brush the
// 10-attempt cap and spuriously 429 mid-file. A fixed synthetic IP
// (distinct from rate-limit.test.js's own randomized range) isolates
// this file's bucket from every other file's.
const HEADERS = { "X-Forwarded-For": "198.51.100.10" };

beforeAll(async () => {
  const { body } = await apiRequest("POST", "/api/v1/users", {
    token: tokenFor("admin"),
    body: { name: "Auth Test User", email: EMAIL, password: PASSWORD, role: "CASHIER" },
  });
  expect(body.success).toBe(true);
});

describe("POST /api/v1/auth/login — web mode (default)", () => {
  it("sets cookies and returns only { user } in the body", async () => {
    const { status, body, headers } = await apiRequest("POST", "/api/v1/auth/login", {
      headers: HEADERS,
      body: { email: EMAIL, password: PASSWORD },
    });
    expect(status).toBe(200);
    expect(body.data.user.email).toBe(EMAIL);
    expect(body.data.accessToken).toBeUndefined();
    expect(body.data.refreshToken).toBeUndefined();
    expect(headers.getSetCookie().length).toBe(2);
  });

  it("wrong password → 401 with a generic message", async () => {
    const { status, body } = await apiRequest("POST", "/api/v1/auth/login", {
      headers: HEADERS,
      body: { email: EMAIL, password: "wrong-password" },
    });
    expect(status).toBe(401);
    expect(body.message).toMatch(/invalid email or password/i);
  });

  it("nonexistent email → the exact same generic 401 (doesn't reveal existence)", async () => {
    const { status, body } = await apiRequest("POST", "/api/v1/auth/login", {
      headers: HEADERS,
      body: { email: "nobody-here@medcare.local", password: "whatever123" },
    });
    expect(status).toBe(401);
    expect(body.message).toMatch(/invalid email or password/i);
  });

  it("missing fields → 422", async () => {
    const { status, body } = await apiRequest("POST", "/api/v1/auth/login", {
      headers: HEADERS,
      body: { email: EMAIL },
    });
    expect(status).toBe(422);
    expect(body.errors.length).toBeGreaterThan(0);
  });
});

describe("POST /api/v1/auth/login — mobile mode", () => {
  it("returns tokens in the body and sets no cookies", async () => {
    const { status, body, headers } = await apiRequest("POST", "/api/v1/auth/login", {
      headers: HEADERS,
      clientType: "mobile",
      body: { email: EMAIL, password: PASSWORD },
    });
    expect(status).toBe(200);
    expect(typeof body.data.accessToken).toBe("string");
    expect(typeof body.data.refreshToken).toBe("string");
    expect(headers.getSetCookie().length).toBe(0);
  });
});

describe("GET /api/v1/auth/me", () => {
  it("returns the caller's user for a valid Bearer token", async () => {
    const { status, body } = await apiRequest("GET", "/api/v1/auth/me", { token: tokenFor("cashier") });
    expect(status).toBe(200);
    expect(body.data.user.role).toBe("CASHIER");
  });

  it("no auth at all → 401", async () => {
    const { status } = await apiRequest("GET", "/api/v1/auth/me");
    expect(status).toBe(401);
  });

  it("malformed Authorization header → 401, not 500", async () => {
    const res = await fetch(`${baseUrl()}/api/v1/auth/me`, {
      headers: { Authorization: "NotBearer garbage-value" },
    });
    expect(res.status).toBe(401);
  });
});

describe("POST /api/v1/auth/refresh — mobile mode", () => {
  it("rotates the refresh token and rejects the old one on replay", async () => {
    const login = await apiRequest("POST", "/api/v1/auth/login", {
      headers: HEADERS,
      clientType: "mobile",
      body: { email: EMAIL, password: PASSWORD },
    });
    const oldRefreshToken = login.body.data.refreshToken;

    const refreshed = await apiRequest("POST", "/api/v1/auth/refresh", {
      headers: HEADERS,
      clientType: "mobile",
      body: { refreshToken: oldRefreshToken },
    });
    expect(refreshed.status).toBe(200);
    expect(refreshed.body.data.accessToken).not.toBe(login.body.data.accessToken);
    expect(refreshed.body.data.refreshToken).not.toBe(oldRefreshToken);

    const replay = await apiRequest("POST", "/api/v1/auth/refresh", {
      headers: HEADERS,
      clientType: "mobile",
      body: { refreshToken: oldRefreshToken },
    });
    expect(replay.status).toBe(401);
  });

  it("missing refreshToken in body → 422", async () => {
    const { status } = await apiRequest("POST", "/api/v1/auth/refresh", {
      headers: HEADERS,
      clientType: "mobile",
      body: {},
    });
    expect(status).toBe(422);
  });
});

describe("POST /api/v1/auth/logout — mobile mode", () => {
  it("revokes the refresh token so a later refresh attempt fails", async () => {
    const login = await apiRequest("POST", "/api/v1/auth/login", {
      headers: HEADERS,
      clientType: "mobile",
      body: { email: EMAIL, password: PASSWORD },
    });
    const { refreshToken } = login.body.data;

    const logout = await apiRequest("POST", "/api/v1/auth/logout", {
      headers: HEADERS,
      clientType: "mobile",
      body: { refreshToken },
    });
    expect(logout.status).toBe(200);

    const refreshAfterLogout = await apiRequest("POST", "/api/v1/auth/refresh", {
      headers: HEADERS,
      clientType: "mobile",
      body: { refreshToken },
    });
    expect(refreshAfterLogout.status).toBe(401);
  });
});

describe("Bearer token parity with cookie auth (Phase 10)", () => {
  it("a Bearer token authorizes exactly like a cookie session would, across role gates", async () => {
    const openRoute = await apiRequest("GET", "/api/v1/products", { token: tokenFor("cashier") });
    expect(openRoute.status).toBe(200);

    const gatedAsWrongRole = await apiRequest("GET", "/api/v1/reports/sales", { token: tokenFor("cashier") });
    expect(gatedAsWrongRole.status).toBe(403);

    const gatedAsRightRole = await apiRequest("GET", "/api/v1/reports/sales", { token: tokenFor("admin") });
    expect(gatedAsRightRole.status).toBe(200);
  });
});
