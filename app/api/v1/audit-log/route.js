import { apiSuccess } from "@/lib/api-response";
import { withApiHandler } from "@/lib/api-handler";
import { validateQuery } from "@/lib/validate";
import { requireAuth, requireRole } from "@/lib/auth";
import { listAuditQuerySchema } from "@/validations/audit.schema";
import { auditService } from "@/services/audit.service";

/**
 * Unifies Phase 8's two immutable record types (StockAdjustment,
 * SaleReturn) into one paginated log — the "full audit/history view"
 * Phase 8 explicitly deferred here. Same Admin/Pharmacist-only gate as
 * its two source resources.
 */
export const GET = withApiHandler(async (request) => {
  const authUser = await requireAuth();
  requireRole(authUser, ["ADMIN", "PHARMACIST"]);

  const { searchParams } = new URL(request.url);
  const query = validateQuery(searchParams, listAuditQuerySchema);

  const { entries, total, page, pageSize } = await auditService.list(query);
  return apiSuccess({ entries, total, page, pageSize });
}, "audit-log/GET");
