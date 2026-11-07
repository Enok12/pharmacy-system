import { apiSuccess } from "@/lib/api-response";
import { withApiHandler } from "@/lib/api-handler";
import { validateBody, validateQuery } from "@/lib/validate";
import { requireAuth } from "@/lib/auth";
import { checkoutSchema, listSalesQuerySchema } from "@/validations/sale.schema";
import { saleService } from "@/services/sale.service";

/**
 * Any authenticated role can view sales — but only their own, if Cashier
 * (see saleService.list). Matches POS access: any role can check out.
 */
export const GET = withApiHandler(async (request) => {
  const authUser = await requireAuth();

  const { searchParams } = new URL(request.url);
  const query = validateQuery(searchParams, listSalesQuerySchema);

  const { sales, total, page, pageSize } = await saleService.list({
    requesterId: authUser.id,
    requesterRole: authUser.role,
    ...query,
  });
  return apiSuccess({ sales, total, page, pageSize });
}, "sales/GET");

/**
 * Finalizes the given line items (from the client's own cart state —
 * there's no server-side cart) into a Sale: atomic FEFO stock deduction
 * and payment recording. No PATCH/DELETE: a completed sale is immutable
 * (corrections are a return, see /api/v1/sale-returns).
 */
export const POST = withApiHandler(async (request) => {
  const authUser = await requireAuth();

  const body = await validateBody(request, checkoutSchema);
  const sale = await saleService.checkout(authUser.id, body);

  return apiSuccess({ sale }, "Sale completed", 201);
}, "sales/POST");
