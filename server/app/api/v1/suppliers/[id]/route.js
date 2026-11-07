import { apiSuccess } from "@/lib/api-response";
import { withApiHandler } from "@/lib/api-handler";
import { validateBody } from "@/lib/validate";
import { requireAuth, requireRole } from "@/lib/auth";
import { updateSupplierSchema } from "@/validations/supplier.schema";
import { supplierService } from "@/services/supplier.service";

export const GET = withApiHandler(async (_request, { params }) => {
  const authUser = await requireAuth();
  requireRole(authUser, ["ADMIN", "PHARMACIST"]);
  const { id } = await params;

  const supplier = await supplierService.getById(id);
  return apiSuccess({ supplier });
}, "suppliers/[id]/GET");

export const PATCH = withApiHandler(async (request, { params }) => {
  const authUser = await requireAuth();
  requireRole(authUser, ["ADMIN", "PHARMACIST"]);
  const { id } = await params;

  const body = await validateBody(request, updateSupplierSchema);
  const supplier = await supplierService.update(id, body);

  return apiSuccess({ supplier }, "Supplier updated");
}, "suppliers/[id]/PATCH");
