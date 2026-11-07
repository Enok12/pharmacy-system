import { apiSuccess } from "@/lib/api-response";
import { withApiHandler } from "@/lib/api-handler";
import { validateQuery } from "@/lib/validate";
import { requireAuth } from "@/lib/auth";
import { listInventoryQuerySchema } from "@/validations/inventory.schema";
import { inventoryService } from "@/services/inventory.service";

/**
 * Any authenticated role can view — Cashier included, same reasoning as
 * Products (needs stock visibility for POS lookups in Phase 6). No
 * requireRole() here, unlike Suppliers/Stock-In.
 */
export const GET = withApiHandler(async (request) => {
  await requireAuth();

  const { searchParams } = new URL(request.url);
  const query = validateQuery(searchParams, listInventoryQuerySchema);

  const { products, total, page, pageSize } = await inventoryService.getSummary(query);
  return apiSuccess({ products, total, page, pageSize });
}, "inventory/GET");
