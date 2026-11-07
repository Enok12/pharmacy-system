import { apiSuccess } from "@/lib/api-response";
import { withApiHandler } from "@/lib/api-handler";
import { requireAuth, requireRole } from "@/lib/auth";
import { reportService } from "@/services/report.service";

export const GET = withApiHandler(async () => {
  const authUser = await requireAuth();
  requireRole(authUser, ["ADMIN", "PHARMACIST"]);

  const report = await reportService.getInventoryValuation();
  return apiSuccess(report);
}, "reports/inventory-valuation/GET");
