import { apiSuccess } from "@/lib/api-response";
import { withApiHandler } from "@/lib/api-handler";
import { validateBody, validateQuery } from "@/lib/validate";
import { requireAuth, requireRole } from "@/lib/auth";
import { createProductSchema, listProductsQuerySchema } from "@/validations/product.schema";
import { productService } from "@/services/product.service";

export const GET = withApiHandler(async (request) => {
  await requireAuth();

  const { searchParams } = new URL(request.url);
  const query = validateQuery(searchParams, listProductsQuerySchema);

  const { products, total, page, pageSize } = await productService.list(query);
  return apiSuccess({ products, total, page, pageSize });
}, "products/GET");

export const POST = withApiHandler(async (request) => {
  const authUser = await requireAuth();
  requireRole(authUser, ["ADMIN", "PHARMACIST"]);

  const body = await validateBody(request, createProductSchema);
  const product = await productService.create(body);

  return apiSuccess({ product }, "Product created", 201);
}, "products/POST");
