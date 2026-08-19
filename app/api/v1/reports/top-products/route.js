import { apiSuccess } from "@/lib/api-response";
import { withApiHandler } from "@/lib/api-handler";
import { validateQuery } from "@/lib/validate";
import { requireAuth, requireRole } from "@/lib/auth";
import { topProductsQuerySchema } from "@/validations/report.schema";
import { reportService } from "@/services/report.service";

export const GET = withApiHandler(async (request) => {
  const authUser = await requireAuth();
  requireRole(authUser, ["ADMIN", "PHARMACIST"]);

  const { searchParams } = new URL(request.url);
  const { from, to, limit } = validateQuery(searchParams, topProductsQuerySchema);

  const products = await reportService.getTopProducts({ from, to, limit });
  return apiSuccess(products);
}, "reports/top-products/GET");
