import { apiSuccess } from "@/lib/api-response";
import { withApiHandler } from "@/lib/api-handler";
import { requireAuth, requireRole } from "@/lib/auth";
import { batchService } from "@/services/batch.service";

export const GET = withApiHandler(async (_request, { params }) => {
  const authUser = await requireAuth();
  requireRole(authUser, ["ADMIN", "PHARMACIST"]);
  const { id } = await params;

  const batch = await batchService.getById(id);
  return apiSuccess({ batch });
}, "batches/[id]/GET");
