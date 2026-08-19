/**
 * Auth helpers (Phase 2).
 *
 * Access + refresh JWTs are carried in httpOnly cookies rather than
 * Authorization headers. That's what lets middleware.js gate routes
 * server-side before any React renders (a token held only in client JS
 * memory/localStorage isn't visible to middleware), and it keeps both
 * tokens out of reach of XSS.
 *
 * Phase 10 adds a fallback: a native Flutter app can't read httpOnly
 * cookies at all, so getAuthUser() also accepts an `Authorization:
 * Bearer <token>` header when there's no cookie. The web app never sends
 * that header, so this is additive — every existing route, service, and
 * requireRole() call is unaffected and doesn't know which transport
 * authenticated the request. See auth/login, auth/refresh, auth/logout
 * for how a mobile client obtains a token in the first place.
 */
import { cookies, headers } from "next/headers";
import { UnauthorizedError, ForbiddenError } from "./errors";
import { verifyAccessToken, refreshTokenTtlMs } from "./jwt";
import { ACCESS_COOKIE, REFRESH_COOKIE } from "./auth-cookies";

export { ACCESS_COOKIE, REFRESH_COOKIE };

// COOKIE_SECURE is an explicit escape hatch, not a general-purpose
// setting — real deployments never set it, so behavior there is
// unchanged (secure in production, not in dev). It exists for Phase 12's
// E2E test: `next start` always forces NODE_ENV=production internally,
// but the local test server runs over plain HTTP, so a `Secure` cookie
// would be set correctly by the server and then correctly refused by
// every client (browser, curl, Playwright) on the very next request —
// this isn't a bug in cookie handling, just a mismatch between "this is
// a production build" and "this connection is actually HTTPS," which
// only a real deployment (fronted by TLS) can guarantee.
const isProd = process.env.NODE_ENV === "production" && process.env.COOKIE_SECURE !== "false";

export function setAuthCookies(cookieStore, { accessToken, refreshToken }) {
  cookieStore.set(ACCESS_COOKIE, accessToken, {
    httpOnly: true,
    secure: isProd,
    sameSite: "lax",
    path: "/",
    maxAge: 15 * 60, // matches ACCESS_TOKEN_TTL default; access token re-issued on refresh anyway
  });
  cookieStore.set(REFRESH_COOKIE, refreshToken, {
    httpOnly: true,
    secure: isProd,
    sameSite: "lax",
    path: "/",
    maxAge: Math.floor(refreshTokenTtlMs() / 1000),
  });
}

export function clearAuthCookies(cookieStore) {
  cookieStore.delete(ACCESS_COOKIE);
  cookieStore.delete(REFRESH_COOKIE);
}

/**
 * Reads and verifies the access token for the current request — cookie
 * first (web), falling back to an `Authorization: Bearer <token>` header
 * (mobile). Returns `{ id, email, role }` or `null` — never throws, so
 * callers can decide whether the route requires auth at all.
 */
export async function getAuthUser() {
  const cookieStore = await cookies();
  let token = cookieStore.get(ACCESS_COOKIE)?.value;

  if (!token) {
    const headerStore = await headers();
    const match = headerStore.get("authorization")?.match(/^Bearer\s+(.+)$/i);
    token = match?.[1];
  }

  if (!token) return null;

  const payload = await verifyAccessToken(token);
  if (!payload) return null;

  return { id: payload.sub, email: payload.email, name: payload.name, role: payload.role };
}

/** Throws UnauthorizedError if there's no valid session. */
export async function requireAuth() {
  const user = await getAuthUser();
  if (!user) throw new UnauthorizedError();
  return user;
}

/** Throws ForbiddenError if the authenticated user's role isn't in `roles`. */
export function requireRole(user, roles) {
  if (!roles.includes(user.role)) {
    throw new ForbiddenError();
  }
}
