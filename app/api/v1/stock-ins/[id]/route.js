import { apiSuccess } from "@/lib/api-response";
import { withApiHandler } from "@/lib/api-handler";
import { requireAuth, requireRole } from "@/lib/auth";
import { stockInService } from "@/services/stockIn.service";

export const GET = withApiHandler(async (_request, { params }) => {
  const authUser = await requireAuth();
  requireRole(authUser, ["ADMIN", "PHARMACIST"]);
  const { id } = await params;

  const stockIn = await stockInService.getById(id);
  return apiSuccess({ stockIn });
}, "stock-ins/[id]/GET");
