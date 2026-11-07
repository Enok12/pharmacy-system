import { apiSuccess } from "@/lib/api-response";
import { withApiHandler } from "@/lib/api-handler";
import { validateBody } from "@/lib/validate";
import { requireAuth, requireRole } from "@/lib/auth";
import { updateProductSchema } from "@/validations/product.schema";
import { productService } from "@/services/product.service";

export const GET = withApiHandler(async (_request, { params }) => {
  await requireAuth();
  const { id } = await params;

  const product = await productService.getById(id);
  return apiSuccess({ product });
}, "products/[id]/GET");

/**
 * PATCH /api/v1/products/:id — Admin/Pharmacist only. Also how
 * deactivate/reactivate happen (isActive is just another field in the
 * patch) — there's no separate DELETE route.
 */
export const PATCH = withApiHandler(async (request, { params }) => {
  const authUser = await requireAuth();
  requireRole(authUser, ["ADMIN", "PHARMACIST"]);
  const { id } = await params;

  const body = await validateBody(request, updateProductSchema);
  const product = await productService.update(id, body);

  return apiSuccess({ product }, "Product updated");
}, "products/[id]/PATCH");
