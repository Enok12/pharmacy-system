import { NextResponse } from "next/server";
import { verifyAccessToken } from "@/lib/jwt";
import { ACCESS_COOKIE } from "@/lib/auth-cookies";

/**
 * Route gating (Phase 2).
 *
 * `proxy.js` (renamed from `middleware.js` in Next.js 16 — see
 * node_modules/next/dist/docs/.../file-conventions/proxy.md) runs before
 * any page renders, so an unauthenticated request never reaches a
 * protected page/route handler in the first place — this is the "gate the
 * (app) layout" piece promised in Phase 1's README.
 *
 * Only checks the access token's validity, not DB state (isActive, role
 * changes since the token was issued) — that's intentionally left to
 * requireAuth()/requireRole() in the route handlers. Proxy is meant to run
 * standalone from the rest of the app (no shared modules/globals per the
 * docs), so it stays Prisma-free even though it now defaults to the
 * Node.js runtime and technically could reach the DB.
 *
 * Phase 10: also accepts an `Authorization: Bearer <token>` header as a
 * fallback when there's no cookie, matching lib/auth.js's getAuthUser()
 * — a mobile client's API calls get the same pre-route gating a browser
 * request does. A page request never carries this header, so it's a
 * no-op for the existing web flow.
 */
const PUBLIC_PAGE_PATHS = ["/login"];
const PUBLIC_API_PREFIXES = ["/api/v1/auth", "/api/v1/health"];

export async function proxy(request) {
  const { pathname } = request.nextUrl;

  const token =
    request.cookies.get(ACCESS_COOKIE)?.value ??
    request.headers.get("authorization")?.match(/^Bearer\s+(.+)$/i)?.[1];
  const payload = token ? await verifyAccessToken(token) : null;
  const isAuthenticated = Boolean(payload);

  if (PUBLIC_API_PREFIXES.some((prefix) => pathname.startsWith(prefix))) {
    return NextResponse.next();
  }

  if (pathname.startsWith("/api")) {
    if (!isAuthenticated) {
      return NextResponse.json(
        { success: false, message: "Authentication required", errors: [] },
        { status: 401 }
      );
    }
    return NextResponse.next();
  }

  if (PUBLIC_PAGE_PATHS.includes(pathname)) {
    if (isAuthenticated) {
      return NextResponse.redirect(new URL("/dashboard", request.url));
    }
    return NextResponse.next();
  }

  if (!isAuthenticated) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("next", pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
