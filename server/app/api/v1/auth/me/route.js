import { apiSuccess } from "@/lib/api-response";
import { withApiHandler } from "@/lib/api-handler";
import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NotFoundError } from "@/lib/errors";

/**
 * GET /api/v1/auth/me
 * Returns the currently authenticated user. Used by the (app) layout to
 * render the real signed-in user in the header instead of Phase 1's
 * hardcoded "Admin" placeholder.
 */
export const GET = withApiHandler(async () => {
  const authUser = await requireAuth();

  const user = await prisma.user.findUnique({ where: { id: authUser.id } });
  if (!user) throw new NotFoundError("User");

  return apiSuccess({
    user: { id: user.id, name: user.name, email: user.email, role: user.role },
  });
}, "auth/me/GET");
