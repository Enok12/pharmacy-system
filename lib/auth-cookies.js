/**
 * Cookie name constants only — kept separate from lib/auth.js because that
 * file imports `next/headers`, which isn't usable from middleware.js
 * (middleware reads cookies via `NextRequest.cookies` instead).
 */
export const ACCESS_COOKIE = "access_token";
export const REFRESH_COOKIE = "refresh_token";
