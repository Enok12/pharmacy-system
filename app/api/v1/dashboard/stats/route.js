import { apiSuccess } from "@/lib/api-response";
import { withApiHandler } from "@/lib/api-handler";
import { requireAuth } from "@/lib/auth";
import { dashboardService } from "@/services/dashboard.service";

/**
 * Open to every role — role-aware inside the service (Cashier gets their
 * own sales-today figure, Admin/Pharmacist get store-wide figures plus
 * inventory value). Same "scoped-not-gated" precedent as Sales (Phase 7).
 */
export const GET = withApiHandler(async () => {
  const authUser = await requireAuth();

  const stats = await dashboardService.getStats({
    requesterId: authUser.id,
    requesterRole: authUser.role,
  });
  return apiSuccess(stats);
}, "dashboard/stats/GET");
