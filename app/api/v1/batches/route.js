import { apiSuccess } from "@/lib/api-response";
import { withApiHandler } from "@/lib/api-handler";
import { validateQuery } from "@/lib/validate";
import { requireAuth, requireRole } from "@/lib/auth";
import { listBatchesQuerySchema } from "@/validations/stockIn.schema";
import { batchService } from "@/services/batch.service";

/**
 * Read-only. Ordered by expiry ascending, which is groundwork for Phase
 * 5's FEFO logic — this route itself does no stock aggregation.
 */
export const GET = withApiHandler(async (request) => {
  const authUser = await requireAuth();
  requireRole(authUser, ["ADMIN", "PHARMACIST"]);

  const { searchParams } = new URL(request.url);
  const query = validateQuery(searchParams, listBatchesQuerySchema);

  const { batches, total, page, pageSize } = await batchService.list(query);
  return apiSuccess({ batches, total, page, pageSize });
}, "batches/GET");
