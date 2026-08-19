import { apiSuccess } from "@/lib/api-response";
import { withApiHandler } from "@/lib/api-handler";
import { validateBody, validateQuery } from "@/lib/validate";
import { requireAuth, requireRole } from "@/lib/auth";
import { createCategorySchema, listCategoriesQuerySchema } from "@/validations/category.schema";
import { categoryService } from "@/services/category.service";

/**
 * GET /api/v1/categories — any authenticated role (Cashier needs read
 * access for POS lookups in a later phase).
 */
export const GET = withApiHandler(async (request) => {
  await requireAuth();

  const { searchParams } = new URL(request.url);
  const query = validateQuery(searchParams, listCategoriesQuerySchema);

  const categories = await categoryService.list(query);
  return apiSuccess({ categories });
}, "categories/GET");

/**
 * POST /api/v1/categories — Admin/Pharmacist only.
 */
export const POST = withApiHandler(async (request) => {
  const authUser = await requireAuth();
  requireRole(authUser, ["ADMIN", "PHARMACIST"]);

  const body = await validateBody(request, createCategorySchema);
  const category = await categoryService.create(body);

  return apiSuccess({ category }, "Category created", 201);
}, "categories/POST");
