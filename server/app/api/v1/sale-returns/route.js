import { apiSuccess } from "@/lib/api-response";
import { withApiHandler } from "@/lib/api-handler";
import { validateBody, validateQuery } from "@/lib/validate";
import { requireAuth, requireRole } from "@/lib/auth";
import { createSaleReturnSchema, listSaleReturnsQuerySchema } from "@/validations/saleReturn.schema";
import { saleReturnService } from "@/services/saleReturn.service";

/**
 * Sales Returns are Admin/Pharmacist only, not even read access for
 * Cashier — a Cashier can sell but not reverse a sale, matching the
 * precedent Phase 4 set for Suppliers/Stock-In.
 */
export const GET = withApiHandler(async (request) => {
  const authUser = await requireAuth();
  requireRole(authUser, ["ADMIN", "PHARMACIST"]);

  const { searchParams } = new URL(request.url);
  const query = validateQuery(searchParams, listSaleReturnsQuerySchema);

  const { returns, total, page, pageSize } = await saleReturnService.list(query);
  return apiSuccess({ returns, total, page, pageSize });
}, "sale-returns/GET");

/**
 * Processes a line-item, partial-quantity return against a completed
 * sale — restocks the exact original FEFO-allocated batch(es) when
 * requested. Immutable once created: no PATCH/DELETE.
 */
export const POST = withApiHandler(async (request) => {
  const authUser = await requireAuth();
  requireRole(authUser, ["ADMIN", "PHARMACIST"]);

  const body = await validateBody(request, createSaleReturnSchema);
  const saleReturn = await saleReturnService.create(authUser.id, body);

  return apiSuccess({ saleReturn }, "Return processed", 201);
}, "sale-returns/POST");
