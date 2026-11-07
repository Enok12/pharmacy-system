import { apiSuccess } from "@/lib/api-response";
import { withApiHandler } from "@/lib/api-handler";
import { validateBody, validateQuery } from "@/lib/validate";
import { requireAuth, requireRole } from "@/lib/auth";
import { createStockInSchema, listStockInsQuerySchema } from "@/validations/stockIn.schema";
import { stockInService } from "@/services/stockIn.service";

export const GET = withApiHandler(async (request) => {
  const authUser = await requireAuth();
  requireRole(authUser, ["ADMIN", "PHARMACIST"]);

  const { searchParams } = new URL(request.url);
  const query = validateQuery(searchParams, listStockInsQuerySchema);

  const { stockIns, total, page, pageSize } = await stockInService.list(query);
  return apiSuccess({ stockIns, total, page, pageSize });
}, "stock-ins/GET");

/**
 * Records a supplier delivery: a StockIn header plus one Batch per line
 * item, created atomically. There's no PATCH/DELETE on this resource —
 * correcting a received quantity is a stock adjustment (Phase 8).
 */
export const POST = withApiHandler(async (request) => {
  const authUser = await requireAuth();
  requireRole(authUser, ["ADMIN", "PHARMACIST"]);

  const body = await validateBody(request, createStockInSchema);
  const stockIn = await stockInService.create(authUser.id, body);

  return apiSuccess({ stockIn }, "Stock-in recorded", 201);
}, "stock-ins/POST");
