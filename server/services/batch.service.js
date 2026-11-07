import { prisma } from "@/lib/prisma";
import { NotFoundError } from "@/lib/errors";

const PRODUCT_SELECT = { id: true, name: true };
const SUPPLIER_SELECT = { id: true, name: true };

function toSafeBatch(batch) {
  return {
    id: batch.id,
    product: batch.product,
    batchNumber: batch.batchNumber,
    expiryDate: batch.expiryDate,
    manufacturingDate: batch.manufacturingDate,
    quantityReceived: batch.quantityReceived,
    quantityRemaining: batch.quantityRemaining,
    costPricePerUnit: Number(batch.costPricePerUnit),
    createdAt: batch.createdAt,
    ...(batch.stockIn ? { stockIn: { id: batch.stockIn.id, supplier: batch.stockIn.supplier } } : {}),
  };
}

export const batchService = {
  async list({ productId, supplierId, page = 1, pageSize = 20 } = {}) {
    const where = {
      ...(productId ? { productId } : {}),
      ...(supplierId ? { stockIn: { supplierId } } : {}),
    };

    const [batches, total] = await Promise.all([
      prisma.batch.findMany({
        where,
        include: { product: { select: PRODUCT_SELECT } },
        orderBy: { expiryDate: "asc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.batch.count({ where }),
    ]);

    return { batches: batches.map(toSafeBatch), total, page, pageSize };
  },

  async getById(id) {
    const batch = await prisma.batch.findUnique({
      where: { id },
      include: {
        product: { select: PRODUCT_SELECT },
        stockIn: { include: { supplier: { select: SUPPLIER_SELECT } } },
      },
    });
    if (!batch) throw new NotFoundError("Batch");
    return toSafeBatch(batch);
  },
};
