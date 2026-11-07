import { apiSuccess } from "@/lib/api-response";
import { withApiHandler } from "@/lib/api-handler";
import { validateBody } from "@/lib/validate";
import { requireAuth, requireRole } from "@/lib/auth";
import { createUserSchema } from "@/validations/user.schema";
import { userService } from "@/services/user.service";

/**
 * GET /api/v1/users — list users (Admin only).
 */
export const GET = withApiHandler(async () => {
  const authUser = await requireAuth();
  requireRole(authUser, ["ADMIN"]);

  const users = await userService.list();
  return apiSuccess({ users });
}, "users/GET");

/**
 * POST /api/v1/users — create a user (Admin only). There's no public
 * signup — accounts are provisioned by an admin, which matches how staff
 * accounts work in a pharmacy (owner/manager sets up logins, not self-serve).
 */
export const POST = withApiHandler(async (request) => {
  const authUser = await requireAuth();
  requireRole(authUser, ["ADMIN"]);

  const body = await validateBody(request, createUserSchema);
  const user = await userService.create(body);

  return apiSuccess({ user }, "User created", 201);
}, "users/POST");
