import { apiSuccess } from "@/lib/api-response";
import { withApiHandler } from "@/lib/api-handler";
import { validateBody, validateQuery } from "@/lib/validate";
import { requireAuth, requireRole } from "@/lib/auth";
import { createAdjustmentSchema, listAdjustmentsQuerySchema } from "@/validations/stockAdjustment.schema";
import { stockAdjustmentService } from "@/services/stockAdjustment.service";

export const GET = withApiHandler(async (request) => {
  const authUser = await requireAuth();
  requireRole(authUser, ["ADMIN", "PHARMACIST"]);

  const { searchParams } = new URL(request.url);
  const query = validateQuery(searchParams, listAdjustmentsQuerySchema);

  const { adjustments, total, page, pageSize } = await stockAdjustmentService.list(query);
  return apiSuccess({ adjustments, total, page, pageSize });
}, "stock-adjustments/GET");

/**
 * Records an immutable correction to a batch's quantityRemaining (damage,
 * expiry write-off, loss, count correction). There's no PATCH/DELETE — a
 * mistaken adjustment gets corrected by posting another one in reverse.
 */
export const POST = withApiHandler(async (request) => {
  const authUser = await requireAuth();
  requireRole(authUser, ["ADMIN", "PHARMACIST"]);

  const body = await validateBody(request, createAdjustmentSchema);
  const adjustment = await stockAdjustmentService.create(authUser.id, body);

  return apiSuccess({ adjustment }, "Stock adjustment recorded", 201);
}, "stock-adjustments/POST");
