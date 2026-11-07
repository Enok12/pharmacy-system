import { apiSuccess } from "@/lib/api-response";
import { withApiHandler } from "@/lib/api-handler";
import { validateBody } from "@/lib/validate";
import { requireAuth, requireRole } from "@/lib/auth";
import { updateCategorySchema } from "@/validations/category.schema";
import { categoryService } from "@/services/category.service";

export const GET = withApiHandler(async (_request, { params }) => {
  await requireAuth();
  const { id } = await params;

  const category = await categoryService.getById(id);
  return apiSuccess({ category });
}, "categories/[id]/GET");

/**
 * PATCH /api/v1/categories/:id — Admin/Pharmacist only. Also how
 * deactivate/reactivate happen (isActive is just another field in the
 * patch) — there's no separate DELETE route.
 */
export const PATCH = withApiHandler(async (request, { params }) => {
  const authUser = await requireAuth();
  requireRole(authUser, ["ADMIN", "PHARMACIST"]);
  const { id } = await params;

  const body = await validateBody(request, updateCategorySchema);
  const category = await categoryService.update(id, body);

  return apiSuccess({ category }, "Category updated");
}, "categories/[id]/PATCH");
