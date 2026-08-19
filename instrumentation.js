/**
 * Runs once when a new Next.js server instance starts, and must complete
 * before the server accepts requests (see node_modules/next/dist/docs/
 * .../file-conventions/instrumentation.md) — the correct hook for
 * "refuse to boot misconfigured," rather than a lazy check that only
 * fires reactively on whichever request happens to import lib/jwt.js first.
 */
export async function register() {
  const { validateEnv } = await import("./lib/env");
  validateEnv();
}
