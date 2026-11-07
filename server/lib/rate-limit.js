/**
 * In-memory, per-IP rate limiting (Phase 11) — login only, the
 * highest-value brute-force/credential-stuffing target. A plain Map
 * stashed on globalThis so counts survive Next dev's module hot-reload,
 * same pattern as lib/prisma.js's client singleton.
 *
 * Single-instance only by design: correct for this app's current scale,
 * and the first thing to swap for a shared store (Redis) if this ever
 * runs behind more than one server process.
 */
const WINDOW_MS = 15 * 60 * 1000;
const MAX_ATTEMPTS = 10;

const globalForRateLimit = globalThis;
const loginAttempts = globalForRateLimit.loginAttempts ?? new Map();
if (process.env.NODE_ENV !== "production") {
  globalForRateLimit.loginAttempts = loginAttempts;
}

/**
 * x-forwarded-for/x-real-ip are the standard signal from a reverse proxy;
 * without one in front, this is spoofable — an app-layer limiter can't
 * fix that, only a trusted proxy/WAF can.
 *
 * Normalizes the IPv4-mapped IPv6 form (`::ffff:127.0.0.1`) some proxies
 * and dual-stack setups report down to plain IPv4 (`127.0.0.1`) — without
 * this, the same real client can get split across two different rate-limit
 * buckets depending on which form a given request happened to arrive with.
 */
export function getClientIp(request) {
  const forwardedFor = request.headers.get("x-forwarded-for");
  const raw = forwardedFor ? forwardedFor.split(",")[0].trim() : request.headers.get("x-real-ip");
  if (!raw) return "unknown";

  return raw.startsWith("::ffff:") ? raw.slice(7) : raw;
}

/**
 * Counts every login attempt (success or failure) against a fixed
 * 15-minute window per IP — generous enough that a legitimate user
 * mistyping their password a few times never notices, while a
 * credential-stuffing script does.
 */
export function checkLoginRateLimit(ip) {
  const now = Date.now();
  const record = loginAttempts.get(ip);

  if (!record || now - record.windowStart >= WINDOW_MS) {
    loginAttempts.set(ip, { windowStart: now, count: 1 });
    return { allowed: true };
  }

  if (record.count >= MAX_ATTEMPTS) {
    return { allowed: false, retryAfterSeconds: Math.ceil((record.windowStart + WINDOW_MS - now) / 1000) };
  }

  record.count += 1;
  return { allowed: true };
}
