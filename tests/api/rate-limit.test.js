import { describe, it, expect, beforeAll } from "vitest";
import { apiRequest } from "../helpers/client.js";
import { tokenFor } from "../helpers/tokens.js";

// A synthetic X-Forwarded-For isolates this test's bucket from every
// other file's login traffic — otherwise, since the limiter is per-IP
// and every test in this suite runs from the same machine, auth.test.js's
// own login/refresh/logout calls would already consume most of the cap
// before this file even runs, making "the 11th attempt is blocked"
// impossible to assert reliably. 203.0.113.0/24 is the RFC 5737 TEST-NET-3
// block, reserved for exactly this kind of documentation/test use.
const FAKE_IP = `203.0.113.${Math.floor(Math.random() * 254) + 1}`;
const HEADERS = { "X-Forwarded-For": FAKE_IP };

let email;
const PASSWORD = "RateLimitTest123";

beforeAll(async () => {
  email = `rate-limit-test-${Date.now()}@medcare.local`;
  const { body } = await apiRequest("POST", "/api/v1/users", {
    token: tokenFor("admin"),
    body: { name: "Rate Limit Test User", email, password: PASSWORD, role: "CASHIER" },
  });
  expect(body.success).toBe(true);
});

describe("Login rate limiting (Phase 11)", () => {
  it("blocks after 10 attempts in the window, regardless of correctness, and shares the cap across web/mobile mode", async () => {
    const attempts = [];
    for (let i = 0; i < 10; i++) {
      const res = await apiRequest("POST", "/api/v1/auth/login", {
        headers: HEADERS,
        body: { email, password: "wrong-password" },
      });
      attempts.push(res.status);
    }
    // All 10 within the cap should be ordinary auth failures, not blocks.
    expect(attempts.every((status) => status === 401)).toBe(true);

    const eleventh = await apiRequest("POST", "/api/v1/auth/login", {
      headers: HEADERS,
      body: { email, password: "wrong-password" },
    });
    expect(eleventh.status).toBe(429);
    expect(eleventh.headers.get("retry-after")).toBeTruthy();

    // Still blocked even with the *correct* password — proves every
    // attempt counts, not just failures.
    const correctButBlocked = await apiRequest("POST", "/api/v1/auth/login", {
      headers: HEADERS,
      body: { email, password: PASSWORD },
    });
    expect(correctButBlocked.status).toBe(429);

    // Mobile-mode login shares the same per-IP cap — same route, same
    // check, before the web/mobile branch.
    const mobileBlocked = await apiRequest("POST", "/api/v1/auth/login", {
      headers: HEADERS,
      clientType: "mobile",
      body: { email, password: PASSWORD },
    });
    expect(mobileBlocked.status).toBe(429);
  });
});
