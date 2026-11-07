/**
 * JWT signing/verification (Phase 2).
 *
 * Uses `jose` instead of `jsonwebtoken` because it works in both the Node
 * runtime (route handlers) and the Edge runtime (middleware.js) with the
 * same API — jsonwebtoken depends on Node's `crypto` module and breaks in
 * middleware.
 *
 * Access and refresh tokens are signed with separate secrets: a leaked
 * access token (short-lived, sent on every request) should never be usable
 * to mint new refresh tokens.
 */
import { SignJWT, jwtVerify } from "jose";

const accessSecret = new TextEncoder().encode(process.env.ACCESS_TOKEN_SECRET);
const refreshSecret = new TextEncoder().encode(process.env.REFRESH_TOKEN_SECRET);

const ACCESS_TOKEN_TTL = process.env.ACCESS_TOKEN_TTL || "15m";
const REFRESH_TOKEN_TTL = process.env.REFRESH_TOKEN_TTL || "7d";

/**
 * @param {{ sub: string, email: string, name: string, role: string }} payload
 */
export async function signAccessToken(payload) {
  return new SignJWT(payload)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(ACCESS_TOKEN_TTL)
    .sign(accessSecret);
}

/**
 * @param {{ sub: string, jti: string }} payload
 */
export async function signRefreshToken(payload) {
  return new SignJWT(payload)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(REFRESH_TOKEN_TTL)
    .sign(refreshSecret);
}

/** Returns the decoded payload, or null if the token is missing/invalid/expired. */
export async function verifyAccessToken(token) {
  try {
    const { payload } = await jwtVerify(token, accessSecret);
    return payload;
  } catch {
    return null;
  }
}

export async function verifyRefreshToken(token) {
  try {
    const { payload } = await jwtVerify(token, refreshSecret);
    return payload;
  } catch {
    return null;
  }
}

export function refreshTokenTtlMs() {
  return parseTtlToMs(REFRESH_TOKEN_TTL);
}

function parseTtlToMs(ttl) {
  const match = /^(\d+)([smhd])$/.exec(ttl);
  if (!match) return 7 * 24 * 60 * 60 * 1000; // fallback: 7 days
  const value = Number(match[1]);
  const unitMs = { s: 1000, m: 60_000, h: 3_600_000, d: 86_400_000 }[match[2]];
  return value * unitMs;
}
