import { apiSuccess } from "@/lib/api-response";
import { withApiHandler } from "@/lib/api-handler";
import { validateQuery } from "@/lib/validate";
import { requireAuth } from "@/lib/auth";
import { fefoQuerySchema } from "@/validations/inventory.schema";
import { inventoryService } from "@/services/inventory.service";

/**
 * Read-only allocation preview — mutates nothing. No consumer yet (Sales
 * don't exist until Phase 7); this is groundwork + a way to verify the
 * FEFO logic now, same precedent as Phase 4's GET /api/v1/batches.
 */
export const GET = withApiHandler(async (request, { params }) => {
  await requireAuth();
  const { id } = await params;

  const { searchParams } = new URL(request.url);
  const { quantity } = validateQuery(searchParams, fefoQuerySchema);

  const allocation = await inventoryService.getFefoAllocation(id, quantity);
  return apiSuccess({ allocation });
}, "inventory/products/[id]/fefo/GET");
