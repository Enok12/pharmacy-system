import { prisma } from "@/lib/prisma";
import { createLogger } from "@/lib/logger";
import { NotFoundError, ValidationError } from "@/lib/errors";

const log = createLogger("services/stock-adjustment-service");

const BATCH_SELECT = { id: true, batchNumber: true, productId: true };
const PERFORMED_BY_SELECT = { id: true, name: true };

function toSafeAdjustment(adjustment) {
  return {
    id: adjustment.id,
    batch: adjustment.batch,
    quantityChange: adjustment.quantityChange,
    reason: adjustment.reason,
    notes: adjustment.notes,
    performedBy: adjustment.performedBy,
    createdAt: adjustment.createdAt,
  };
}

export const stockAdjustmentService = {
  async create(performedById, { batchId, quantityChange, reason, notes }) {
    const batch = await prisma.batch.findUnique({ where: { id: batchId } });
    if (!batch) throw new NotFoundError("Batch");

    if (batch.quantityRemaining + quantityChange < 0) {
      throw new ValidationError("Validation failed", [
        { field: "quantityChange", message: "Adjustment would result in negative stock" },
      ]);
    }

    const adjustment = await prisma.$transaction(async (tx) => {
      const created = await tx.stockAdjustment.create({
        data: { batchId, quantityChange, reason, notes, performedById },
        include: { batch: { select: BATCH_SELECT }, performedBy: { select: PERFORMED_BY_SELECT } },
      });
      await tx.batch.update({
        where: { id: batchId },
        data: { quantityRemaining: { increment: quantityChange } },
      });
      return created;
    });

    log.info("Stock adjustment recorded", { adjustmentId: adjustment.id, batchId, quantityChange });
    return toSafeAdjustment(adjustment);
  },

  async list({ batchId, page = 1, pageSize = 20 } = {}) {
    const where = { ...(batchId ? { batchId } : {}) };

    const [adjustments, total] = await Promise.all([
      prisma.stockAdjustment.findMany({
        where,
        include: { batch: { select: BATCH_SELECT }, performedBy: { select: PERFORMED_BY_SELECT } },
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.stockAdjustment.count({ where }),
    ]);

    return { adjustments: adjustments.map(toSafeAdjustment), total, page, pageSize };
  },
};
