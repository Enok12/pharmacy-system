import { apiSuccess } from "@/lib/api-response";
import { withApiHandler } from "@/lib/api-handler";
import { requireAuth } from "@/lib/auth";
import { dashboardService } from "@/services/dashboard.service";

/**
 * Open to every role — low-stock/expiring alerts are already fully open
 * on the Inventory page itself (Phase 5), so gating them here would be
 * inconsistent.
 */
export const GET = withApiHandler(async () => {
  await requireAuth();

  const alerts = await dashboardService.getAlerts();
  return apiSuccess(alerts);
}, "dashboard/alerts/GET");
