import { apiSuccess } from "@/lib/api-response";
import { withApiHandler } from "@/lib/api-handler";
import { requireAuth, requireRole } from "@/lib/auth";
import { saleReturnService } from "@/services/saleReturn.service";

export const GET = withApiHandler(async (_request, { params }) => {
  const authUser = await requireAuth();
  requireRole(authUser, ["ADMIN", "PHARMACIST"]);

  const { id } = await params;
  const saleReturn = await saleReturnService.getById(id);
  return apiSuccess({ saleReturn });
}, "sale-returns/[id]/GET");
