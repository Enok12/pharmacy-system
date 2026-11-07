import { apiSuccess } from "@/lib/api-response";
import { withApiHandler } from "@/lib/api-handler";
import { requireAuth, requireRole } from "@/lib/auth";
import { saleReturnService } from "@/services/saleReturn.service";

/**
 * Backs the "start a return" UI step: looks up a sale by id and shows,
 * per line, how much has already been returned and how much is still
 * returnable — before a return is submitted.
 */
export const GET = withApiHandler(async (_request, { params }) => {
  const authUser = await requireAuth();
  requireRole(authUser, ["ADMIN", "PHARMACIST"]);

  const { id } = await params;
  const sale = await saleReturnService.getReturnableSale(id);
  return apiSuccess({ sale });
}, "sales/[id]/returnable/GET");
