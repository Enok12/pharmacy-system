import { cookies } from "next/headers";
import { apiSuccess } from "@/lib/api-response";
import { withApiHandler } from "@/lib/api-handler";
import { validateBody } from "@/lib/validate";
import { setAuthCookies, REFRESH_COOKIE } from "@/lib/auth";
import { mobileRefreshSchema } from "@/validations/auth.schema";
import { authService } from "@/services/auth.service";

/**
 * POST /api/v1/auth/refresh
 * Rotates the refresh token and issues a new access token. The old refresh
 * token is revoked as part of authService.refresh — see the comment there
 * on why rotation instead of a long-lived static refresh token.
 *
 * Web clients (default) send the refresh token via cookie and get a new
 * cookie pair back. Mobile clients (`X-Client-Type: mobile`) have nowhere
 * to keep a cookie, so they send `{ refreshToken }` in the body and get
 * the new pair back the same way — see auth/login for the matching mode.
 */
export const POST = withApiHandler(async (request) => {
  const isMobile = request.headers.get("x-client-type")?.toLowerCase() === "mobile";

  if (isMobile) {
    const { refreshToken } = await validateBody(request, mobileRefreshSchema);
    const { user, accessToken, refreshToken: newRefreshToken } =
      await authService.refresh(refreshToken);
    return apiSuccess({ user, accessToken, refreshToken: newRefreshToken }, "Session refreshed");
  }

  const cookieStore = await cookies();
  const refreshToken = cookieStore.get(REFRESH_COOKIE)?.value;

  const { user, accessToken, refreshToken: newRefreshToken } =
    await authService.refresh(refreshToken);

  setAuthCookies(cookieStore, { accessToken, refreshToken: newRefreshToken });

  return apiSuccess({ user }, "Session refreshed");
}, "auth/refresh/POST");
