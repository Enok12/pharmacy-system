import { cookies } from "next/headers";
import { apiSuccess, apiError } from "@/lib/api-response";
import { withApiHandler } from "@/lib/api-handler";
import { validateBody } from "@/lib/validate";
import { setAuthCookies } from "@/lib/auth";
import { getClientIp, checkLoginRateLimit } from "@/lib/rate-limit";
import { loginSchema } from "@/validations/auth.schema";
import { authService } from "@/services/auth.service";

/**
 * POST /api/v1/auth/login
 * Verifies credentials and starts a session.
 *
 * Web clients (default): httpOnly access + refresh token cookies are
 * set; the response body never contains the raw tokens. See lib/auth.js
 * for why.
 *
 * Mobile clients (`X-Client-Type: mobile` header): no cookies are set —
 * a native app can't read httpOnly cookies anyway — and the tokens are
 * returned in the body instead, for the app to store itself and send
 * back as `Authorization: Bearer <token>`. The two modes are mutually
 * exclusive per-request so a web session's tokens are never exposed to
 * page JS (see the Phase 10 plan for why that matters for XSS).
 *
 * Rate-limited per IP before anything else runs (Phase 11) — the
 * highest-value brute-force/credential-stuffing target in the app.
 */
export const POST = withApiHandler(async (request) => {
  const rateLimit = checkLoginRateLimit(getClientIp(request));
  if (!rateLimit.allowed) {
    const res = apiError("Too many login attempts. Please try again later.", [], 429);
    res.headers.set("Retry-After", String(rateLimit.retryAfterSeconds));
    return res;
  }

  const { email, password } = await validateBody(request, loginSchema);
  const { user, accessToken, refreshToken } = await authService.login(email, password);

  if (request.headers.get("x-client-type")?.toLowerCase() === "mobile") {
    return apiSuccess({ user, accessToken, refreshToken }, "Logged in successfully");
  }

  const cookieStore = await cookies();
  setAuthCookies(cookieStore, { accessToken, refreshToken });

  return apiSuccess({ user }, "Logged in successfully");
}, "auth/login/POST");
