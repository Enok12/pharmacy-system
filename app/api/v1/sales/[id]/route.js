import { apiSuccess } from "@/lib/api-response";
import { withApiHandler } from "@/lib/api-handler";
import { requireAuth } from "@/lib/auth";
import { saleService } from "@/services/sale.service";

export const GET = withApiHandler(async (_request, { params }) => {
  const authUser = await requireAuth();
  const { id } = await params;

  const sale = await saleService.getById(id, {
    requesterId: authUser.id,
    requesterRole: authUser.role,
  });
  return apiSuccess({ sale });
}, "sales/[id]/GET");
