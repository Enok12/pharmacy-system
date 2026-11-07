/**
 * Startup environment validation (Phase 11).
 *
 * lib/jwt.js encodes ACCESS_TOKEN_SECRET/REFRESH_TOKEN_SECRET directly
 * with no existence check — if either were ever unset in a deployment,
 * `TextEncoder().encode(undefined)` would silently sign every token with
 * the literal string "undefined" as the key, forgeable by anyone who
 * guessed that. This fails loudly at boot instead (see instrumentation.js).
 */
const REQUIRED = ["DATABASE_URL", "ACCESS_TOKEN_SECRET", "REFRESH_TOKEN_SECRET"];
const MIN_SECRET_LENGTH = 32;

export function validateEnv() {
  const missing = REQUIRED.filter((key) => !process.env[key]);
  if (missing.length > 0) {
    throw new Error(`Missing required environment variable(s): ${missing.join(", ")}`);
  }

  for (const key of ["ACCESS_TOKEN_SECRET", "REFRESH_TOKEN_SECRET"]) {
    if (process.env[key].length < MIN_SECRET_LENGTH) {
      throw new Error(
        `${key} must be at least ${MIN_SECRET_LENGTH} characters (got ${process.env[key].length}) — generate one with: node -e "console.log(require('crypto').randomBytes(48).toString('base64'))"`
      );
    }
  }
}
