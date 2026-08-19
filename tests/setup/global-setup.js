import { spawn, execSync } from "node:child_process";
import { writeFileSync, readFileSync, existsSync, rmSync } from "node:fs";
import path from "node:path";
import net from "node:net";

const ROOT = path.resolve(import.meta.dirname, "../..");
const RUNTIME_FILE = path.join(ROOT, "tests", ".runtime.json");

const TEST_PASSWORD = "TestPass123";
const PHARMACIST_EMAIL = "test-pharmacist@medcare.local";
const CASHIER_EMAIL = "test-cashier@medcare.local";

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

function isPortInUse(port) {
  return new Promise((resolve) => {
    const socket = net.createConnection({ host: "127.0.0.1", port }, () => {
      socket.destroy();
      resolve(true);
    });
    socket.on("error", () => resolve(false));
    socket.setTimeout(1000, () => {
      socket.destroy();
      resolve(false);
    });
  });
}

async function waitForHealth(baseUrl, timeoutMs = 90000) {
  const start = Date.now();
  let lastError;
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(`${baseUrl}/api/v1/health`);
      if (res.ok) return;
    } catch (err) {
      lastError = err;
    }
    await new Promise((r) => setTimeout(r, 1000));
  }
  throw new Error(`Test server did not become healthy within ${timeoutMs}ms: ${lastError}`);
}

// Turbopack dev compiles each route on its first hit — the health check
// route (already warm) can pass while the very next route requested is
// still compiling, and during that window the server can refuse/time out
// new connections rather than just respond slowly. Retrying on
// connection-level failures (not on real HTTP error responses) rides
// out that window instead of failing setup outright.
async function fetchWithRetry(url, options, { retries = 5, delayMs = 1500 } = {}) {
  let lastError;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await fetch(url, options);
    } catch (err) {
      lastError = err;
      await new Promise((r) => setTimeout(r, delayMs));
    }
  }
  throw lastError;
}

// Wraps the one-off `prisma migrate reset` call — see its call site for
// why Neon's cold-start makes this necessary too.
async function runWithRetry(fn, { retries = 2, delayMs = 5000 } = {}) {
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return fn();
    } catch (err) {
      if (attempt === retries) throw err;
      console.warn(`Command failed (attempt ${attempt + 1}/${retries + 1}), retrying in ${delayMs}ms...`);
      await new Promise((r) => setTimeout(r, delayMs));
    }
  }
}

async function login(baseUrl, email, password) {
  const res = await fetchWithRetry(`${baseUrl}/api/v1/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Client-Type": "mobile" },
    body: JSON.stringify({ email, password }),
  });
  const json = await res.json();
  if (!json.success) throw new Error(`Login failed for ${email}: ${json.message}`);
  return json.data.accessToken;
}

async function createUser(baseUrl, adminToken, { name, email, password, role }) {
  const res = await fetchWithRetry(`${baseUrl}/api/v1/users`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${adminToken}` },
    body: JSON.stringify({ name, email, password, role }),
  });
  const json = await res.json();
  // Idempotent across repeated local runs against an already-seeded schema.
  if (!json.success && !json.message?.includes("already exists")) {
    throw new Error(`Failed to create ${role} test user: ${json.message}`);
  }
}

export default async function setup() {
  const merged = { ...process.env, ...loadEnvFile(".env"), ...loadEnvFile(".env.test") };
  const testPort = merged.TEST_PORT || "3099";
  // 127.0.0.1, not "localhost" — Node's fetch() can alternate between
  // resolving "localhost" to the IPv6 (::1) and IPv4-mapped loopback
  // address across calls, which split the Phase 11 rate limiter's count
  // across two buckets during manual verification. A fixed literal
  // avoids that same flakiness here.
  const baseUrl = `http://127.0.0.1:${testPort}`;

  // 1. Reset + seed the TEST schema only — DATABASE_URL is overridden to
  // the test-schema URL for this child process alone, so the dev
  // database (default DATABASE_URL, `public` schema) is never touched.
  //
  // Neon (serverless Postgres) suspends compute for an idle database;
  // the very first connection attempt after a while can fail outright
  // (P1001) rather than just being slow, since the Prisma CLI — unlike
  // the app's own long-lived connection pool (lib/prisma.js) — makes a
  // brand-new connection per invocation with no retry of its own. One
  // retry after a short delay reliably succeeds once Neon has woken up.
  await runWithRetry(() =>
    execSync("npx prisma migrate reset --force", { cwd: ROOT, env: merged, stdio: "inherit", shell: true })
  );

  // 2. Refuse to build while a regular `next dev` is running. A
  // concurrent `next build` — even into its own distDir — was found to
  // corrupt the build (garbled CSS, a bogus prerender TypeError on `/`)
  // from both processes contending for the same source files during
  // compilation. Rather than silently killing a process this script
  // doesn't own, fail with a clear, actionable message.
  if (await isPortInUse(3000)) {
    throw new Error(
      "A dev server appears to be running on port 3000. Stop it (Ctrl+C, or close that terminal) before running tests — a concurrent `next dev` + this suite's `next build` corrupts the build. See tests/setup/global-setup.js for details."
    );
  }

  // 3. Build once, then start a production server — not `next dev`.
  // `next dev` compiles each route on its first hit, and under this
  // suite's request volume that on-demand compile was observed to block
  // the server's request handling for minutes at a time (not just add a
  // few seconds), causing hard-to-diagnose hangs/timeouts mid-run. A
  // pre-built server has every route already compiled, eliminating that
  // whole failure class — worth the extra ~20-40s upfront build time.
  //
  // Uses its own distDir, wiped before every build so no partial/
  // corrupted cache from a previously-killed run survives.
  //
  // NODE_ENV is deliberately deleted, not inherited from `.env`
  // ("development") — `next build`/`next start` need to control it
  // themselves (production), and forcing it to "development" via the
  // child process's env produced exactly this failure: a broken `/`
  // prerender (TypeError deep in Next's internals) plus Next's own
  // "non-standard NODE_ENV" warning. `.env`'s NODE_ENV is meant for
  // `next dev`, not this.
  const buildEnv = { ...merged, NEXT_DIST_DIR: ".next-test" };
  delete buildEnv.NODE_ENV;
  rmSync(path.join(ROOT, ".next-test"), { recursive: true, force: true });
  execSync("npx next build", { cwd: ROOT, env: buildEnv, stdio: "inherit", shell: true });

  const server = spawn(`npx next start -p ${testPort}`, {
    cwd: ROOT,
    env: buildEnv,
    stdio: "pipe",
    shell: true,
  });
  let serverOutput = "";
  server.stdout?.on("data", (d) => (serverOutput += d.toString()));
  server.stderr?.on("data", (d) => (serverOutput += d.toString()));

  try {
    await waitForHealth(baseUrl);
  } catch (err) {
    console.error("Test server output:\n" + serverOutput);
    throw err;
  }

  // 3. Obtain tokens for all three roles — once, here, not per test file
  // (see Phase 12 plan design decision 3 re: the login rate limiter).
  const adminToken = await login(baseUrl, merged.SEED_ADMIN_EMAIL, merged.SEED_ADMIN_PASSWORD);

  await createUser(baseUrl, adminToken, {
    name: "Test Pharmacist",
    email: PHARMACIST_EMAIL,
    password: TEST_PASSWORD,
    role: "PHARMACIST",
  });
  await createUser(baseUrl, adminToken, {
    name: "Test Cashier",
    email: CASHIER_EMAIL,
    password: TEST_PASSWORD,
    role: "CASHIER",
  });

  const pharmacistToken = await login(baseUrl, PHARMACIST_EMAIL, TEST_PASSWORD);
  const cashierToken = await login(baseUrl, CASHIER_EMAIL, TEST_PASSWORD);

  writeFileSync(
    RUNTIME_FILE,
    JSON.stringify(
      { baseUrl, tokens: { admin: adminToken, pharmacist: pharmacistToken, cashier: cashierToken } },
      null,
      2
    )
  );

  return function teardown() {
    // On Windows, server.kill() only signals the shell wrapper (spawned
    // with shell: true) — the actual `next dev` process it launched
    // survives and keeps the event loop (and the port) alive. Kill the
    // whole process tree instead.
    if (process.platform === "win32") {
      execSync(`taskkill /pid ${server.pid} /T /F`, { stdio: "ignore" });
    } else {
      server.kill();
    }
  };
}
