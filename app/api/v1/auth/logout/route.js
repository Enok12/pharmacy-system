import { cookies } from "next/headers";
import { apiSuccess } from "@/lib/api-response";
import { withApiHandler } from "@/lib/api-handler";
import { clearAuthCookies, REFRESH_COOKIE } from "@/lib/auth";
import { authService } from "@/services/auth.service";

/**
 * POST /api/v1/auth/logout
 * Revokes the current refresh token server-side (not just clearing the
 * cookie) so a copy of the token captured before logout can't be replayed.
 *
 * Mobile clients (`X-Client-Type: mobile`) have no cookie to clear —
 * they send `{ refreshToken }` in the body instead. authService.logout
 * is best-effort either way (a missing/already-revoked token is a no-op).
 */
export const POST = withApiHandler(async (request) => {
  const isMobile = request.headers.get("x-client-type")?.toLowerCase() === "mobile";

  if (isMobile) {
    const body = await request.json().catch(() => ({}));
    await authService.logout(body?.refreshToken);
    return apiSuccess({}, "Logged out");
  }

  const cookieStore = await cookies();
  const refreshToken = cookieStore.get(REFRESH_COOKIE)?.value;

  await authService.logout(refreshToken);
  clearAuthCookies(cookieStore);

  return apiSuccess({}, "Logged out");
}, "auth/logout/POST");
