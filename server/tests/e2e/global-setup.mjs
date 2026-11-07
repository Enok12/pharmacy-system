import { execSync } from "node:child_process";
import { readFileSync, existsSync } from "node:fs";
import path from "node:path";
import net from "node:net";

const ROOT = path.resolve(import.meta.dirname, "../..");

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

// Runnable standalone (without `npm test` having run first) — deploys
// any pending migrations (never wipes existing data, unlike Vitest's
// suite-level `migrate reset`) and seeds the Admin account if it isn't
// already there (prisma/seed.mjs is idempotent). Reuses the same test
// schema as the API suite; the E2E journey only needs the seeded Admin.
export default async function globalSetup() {
  // The webServer.command that runs next builds right after this — same
  // "don't build while a regular next dev is running" guard as the API
  // suite (tests/setup/global-setup.js), for the same reason (concurrent
  // next dev + next build corrupts the build).
  if (await isPortInUse(3000)) {
    throw new Error(
      "A dev server appears to be running on port 3000. Stop it before running the E2E test — a concurrent `next dev` + this suite's `next build` corrupts the build."
    );
  }

  const merged = { ...process.env, ...loadEnvFile(".env"), ...loadEnvFile(".env.test") };

  execSync("npx prisma migrate deploy", { cwd: ROOT, env: merged, stdio: "inherit", shell: true });
  execSync("node prisma/seed.mjs", { cwd: ROOT, env: merged, stdio: "inherit", shell: true });
}
