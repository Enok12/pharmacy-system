import { apiSuccess } from "@/lib/api-response";
import { withApiHandler } from "@/lib/api-handler";
import { validateQuery } from "@/lib/validate";
import { requireAuth, requireRole } from "@/lib/auth";
import { dateRangeQuerySchema } from "@/validations/report.schema";
import { reportService } from "@/services/report.service";

export const GET = withApiHandler(async (request) => {
  const authUser = await requireAuth();
  requireRole(authUser, ["ADMIN", "PHARMACIST"]);

  const { searchParams } = new URL(request.url);
  const { from, to } = validateQuery(searchParams, dateRangeQuerySchema);

  const report = await reportService.getSalesReport({ from, to });
  return apiSuccess(report);
}, "reports/sales/GET");
