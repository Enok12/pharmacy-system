import { apiSuccess } from "@/lib/api-response";
import { withApiHandler } from "@/lib/api-handler";
import { requireAuth } from "@/lib/auth";
import { inventoryService } from "@/services/inventory.service";

/**
 * FEFO-ordered (soonest expiry first) batch list for one product — this
 * order is what a pharmacist should physically pick from.
 */
export const GET = withApiHandler(async (_request, { params }) => {
  await requireAuth();
  const { id } = await params;

  const batches = await inventoryService.getProductBatches(id);
  return apiSuccess({ batches });
}, "inventory/products/[id]/batches/GET");
