import { apiSuccess } from "@/lib/api-response";
import { withApiHandler } from "@/lib/api-handler";
import { validateBody, validateQuery } from "@/lib/validate";
import { requireAuth, requireRole } from "@/lib/auth";
import { createSupplierSchema, listSuppliersQuerySchema } from "@/validations/supplier.schema";
import { supplierService } from "@/services/supplier.service";

/**
 * Unlike products, Cashier has no access at all here — not even GET. So
 * every method requires the Admin/Pharmacist role, not just requireAuth().
 */
export const GET = withApiHandler(async (request) => {
  const authUser = await requireAuth();
  requireRole(authUser, ["ADMIN", "PHARMACIST"]);

  const { searchParams } = new URL(request.url);
  const query = validateQuery(searchParams, listSuppliersQuerySchema);

  const suppliers = await supplierService.list(query);
  return apiSuccess({ suppliers });
}, "suppliers/GET");

export const POST = withApiHandler(async (request) => {
  const authUser = await requireAuth();
  requireRole(authUser, ["ADMIN", "PHARMACIST"]);

  const body = await validateBody(request, createSupplierSchema);
  const supplier = await supplierService.create(body);

  return apiSuccess({ supplier }, "Supplier created", 201);
}, "suppliers/POST");
