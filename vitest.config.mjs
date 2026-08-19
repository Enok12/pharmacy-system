import { defineConfig } from "vitest/config";

/**
 * Phase 12 — integration test config.
 *
 * Tests hit a real running `next dev` server (started by globalSetup)
 * over HTTP, not direct route-handler calls — see the Phase 12 plan for
 * why (next/headers' cookies()/headers() need a real request context).
 * fileParallelism is off: this is one shared server + database, and
 * parallel files would race on the login rate limiter, Sale.saleNumber
 * sequencing, and count-based assertions.
 */
export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/api/**/*.test.js"],
    globalSetup: ["./tests/setup/global-setup.js"],
    fileParallelism: false,
    testTimeout: 30000,
    hookTimeout: 120000,
  },
});
