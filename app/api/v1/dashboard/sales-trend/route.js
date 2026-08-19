import { apiSuccess } from "@/lib/api-response";
import { withApiHandler } from "@/lib/api-handler";
import { validateQuery } from "@/lib/validate";
import { requireAuth, requireRole } from "@/lib/auth";
import { salesTrendQuerySchema } from "@/validations/dashboard.schema";
import { dashboardService } from "@/services/dashboard.service";

export const GET = withApiHandler(async (request) => {
  const authUser = await requireAuth();
  requireRole(authUser, ["ADMIN", "PHARMACIST"]);

  const { searchParams } = new URL(request.url);
  const { days } = validateQuery(searchParams, salesTrendQuerySchema);

  const trend = await dashboardService.getSalesTrend({ days });
  return apiSuccess(trend);
}, "dashboard/sales-trend/GET");
