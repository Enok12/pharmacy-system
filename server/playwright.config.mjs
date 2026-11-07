import { defineConfig } from "@playwright/test";
import { execSync } from "node:child_process";
import { readFileSync, existsSync, rmSync } from "node:fs";
import path from "node:path";

const ROOT = import.meta.dirname;

function loadEnvFile(relPath) {
  const full = path.join(ROOT, relPath);
  if (!existsSync(full)) return {};
  const content = readFileSync(full, "utf8");
  const env = {};
  for (const line of content.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    env[key] = value;
  }
  return env;
}

const merged = { ...process.env, ...loadEnvFile(".env"), ...loadEnvFile(".env.test") };

// A distinct port AND distDir from the Vitest API suite's test server
// (3099 / .next-test) — independently runnable, no risk of colliding if
// both happen to run around the same time. Same test-schema database,
// though (see tests/e2e/global-setup.js): the golden-path journey only
// needs the seeded Admin, which persists across both suites' runs.
//
// The distDir must be its own, and wiped before each build — sharing
// `.next` with a concurrently-running regular `next dev` caused real
// build corruption (see tests/setup/global-setup.js for the fuller
// story), and a stale/partial distDir from a previously-killed run can
// poison the next incremental build.
const E2E_PORT = 3098;
const E2E_DIST_DIR = ".next-e2e-test";
rmSync(path.join(ROOT, E2E_DIST_DIR), { recursive: true, force: true });

// NODE_ENV is deliberately deleted, not inherited from `.env`
// ("development") — `next build`/`next start` need to control it
// themselves. Forcing it to "development" broke `/`'s static prerender
// outright (see tests/setup/global-setup.js for the full story).
//
// COOKIE_SECURE=false is the E2E-specific override (see lib/auth.js) —
// `next start` always runs as NODE_ENV=production internally, which
// would mark the session cookies `Secure`; every client correctly
// refuses to send those back over this test server's plain HTTP,
// breaking the web login this test exercises. Real deployments never
// set this, so production cookie behavior is unaffected.
const buildEnv = { ...merged, NEXT_DIST_DIR: E2E_DIST_DIR, COOKIE_SECURE: "false" };
delete buildEnv.NODE_ENV;

// Built here, synchronously, as its own step — not chained as `next
// build && next start` inside webServer.command. On this project's slow
// filesystem (already flagged by Next's own dev-server warning), the
// shell `&&` only waits for the build process's exit code, not for its
// output to be fully flushed/visible; `next start` immediately after
// intermittently failed with "client reference manifest ... does not
// exist" against files that weren't actually done being written yet.
// Running the build to completion here, before webServer even starts,
// avoids that race entirely.
//
// Invokes Next's CLI entrypoint directly with `node`, not `npx next` —
// npx adds its own wrapper process on top of the shell Playwright/
// execSync already spawn, and on Windows that extra layer was why
// Playwright's webServer teardown couldn't cleanly kill the server
// afterward (it could only signal the outermost wrapper, not the actual
// `next start` process underneath — same class of issue already worked
// around in tests/setup/global-setup.js's teardown).
const NEXT_BIN = path.join(ROOT, "node_modules/next/dist/bin/next");
execSync(`node "${NEXT_BIN}" build`, { cwd: ROOT, env: buildEnv, stdio: "inherit", shell: true });

export default defineConfig({
  testDir: "./tests/e2e",
  timeout: 60000,
  fullyParallel: false,
  workers: 1,
  globalSetup: "./tests/e2e/global-setup.mjs",
  use: {
    baseURL: `http://127.0.0.1:${E2E_PORT}`,
    // Bundled Chromium, not the system-msedge channel — msedge left the
    // test worker process unable to exit cleanly (a 5-minute
    // force-kill timeout every run), the same class of leftover-process
    // quirk this session already hit earlier with ad-hoc msedge-driven
    // scripts. Chromium is Playwright's primary supported path and its
    // process lifecycle is managed reliably by the test runner itself.
    screenshot: "only-on-failure",
  },
  webServer: {
    command: `node "${NEXT_BIN}" start -p ${E2E_PORT}`,
    url: `http://127.0.0.1:${E2E_PORT}/api/v1/health`,
    reuseExistingServer: false,
    timeout: 180000,
    env: buildEnv,
  },
});
