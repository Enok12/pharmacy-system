import { stockAdjustmentService } from "./stockAdjustment.service";
import { saleReturnService } from "./saleReturn.service";

// Merges two Prisma models in application code rather than a raw SQL
// UNION: fetch the most recent `page * pageSize` rows from each (both
// already sorted `createdAt desc` by their own services), tag with a
// `type` discriminator, merge-sort, and slice to the requested page.
// Correct at any page depth and cheap at this app's scale — see the
// Phase 9 plan for why this beats introducing the app's first raw query.
export const auditService = {
  async list({ page = 1, pageSize = 20 } = {}) {
    const take = page * pageSize;

    const [adjustmentsResult, returnsResult] = await Promise.all([
      stockAdjustmentService.list({ page: 1, pageSize: take }),
      saleReturnService.list({ page: 1, pageSize: take }),
    ]);

    const merged = [
      ...adjustmentsResult.adjustments.map((a) => ({ type: "STOCK_ADJUSTMENT", ...a })),
      ...returnsResult.returns.map((r) => ({ type: "SALE_RETURN", ...r })),
    ].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    const entries = merged.slice((page - 1) * pageSize, page * pageSize);
    const total = adjustmentsResult.total + returnsResult.total;

    return { entries, total, page, pageSize };
  },
};
