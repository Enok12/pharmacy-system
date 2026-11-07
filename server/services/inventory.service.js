import { prisma } from "@/lib/prisma";
import { NotFoundError } from "@/lib/errors";

const EXPIRING_SOON_DAYS = 30;

const CATEGORY_SELECT = { id: true, name: true };
const SUPPLIER_SELECT = { id: true, name: true };

function computeBatchStatus(expiryDate, now) {
  if (expiryDate < now) return "EXPIRED";
  const soonThreshold = new Date(now.getTime() + EXPIRING_SOON_DAYS * 24 * 60 * 60 * 1000);
  if (expiryDate <= soonThreshold) return "EXPIRING_SOON";
  return "OK";
}

function summarizeProduct(product, now) {
  const activeBatches = product.batches.filter((b) => b.quantityRemaining > 0);
  const totalRemaining = activeBatches.reduce((sum, b) => sum + b.quantityRemaining, 0);

  let nearestExpiry = null;
  let expiringSoonCount = 0;
  let expiredCount = 0;
  for (const batch of activeBatches) {
    const status = computeBatchStatus(batch.expiryDate, now);
    if (status === "EXPIRED") expiredCount += 1;
    if (status === "EXPIRING_SOON") expiringSoonCount += 1;
    if (!nearestExpiry || batch.expiryDate < nearestExpiry) nearestExpiry = batch.expiryDate;
  }

  const stockStatus =
    totalRemaining === 0 ? "OUT" : totalRemaining <= product.reorderLevel ? "LOW" : "OK";

  return {
    id: product.id,
    name: product.name,
    genericName: product.genericName,
    category: product.category,
    unitOfMeasure: product.unitOfMeasure,
    reorderLevel: product.reorderLevel,
    totalRemaining,
    nearestExpiry,
    expiringSoonCount,
    expiredCount,
    stockStatus,
  };
}

// Shared by every caller that needs per-product stock/expiry status —
// getSummary (Phase 5), getAlertCounts and getExpiringBatches (Phase 9) —
// so the Dashboard's alert numbers and Inventory page's badges can never
// drift apart by computing the same thing two different ways.
async function getAllSummaries(now, { search } = {}) {
  const products = await prisma.product.findMany({
    where: {
      isActive: true,
      ...(search
        ? {
            OR: [
              { name: { contains: search, mode: "insensitive" } },
              { genericName: { contains: search, mode: "insensitive" } },
            ],
          }
        : {}),
    },
    include: {
      category: { select: CATEGORY_SELECT },
      batches: { select: { quantityRemaining: true, expiryDate: true } },
    },
    orderBy: { name: "asc" },
  });

  return products.map((product) => summarizeProduct(product, now));
}

export const inventoryService = {
  async getSummary({ search, stockStatus, page = 1, pageSize = 20 } = {}) {
    const now = new Date();

    let summaries = await getAllSummaries(now, { search });
    if (stockStatus) {
      summaries = summaries.filter((s) => s.stockStatus === stockStatus);
    }

    const total = summaries.length;
    const paged = summaries.slice((page - 1) * pageSize, page * pageSize);

    return { products: paged, total, page, pageSize };
  },

  // Backs Dashboard stat cards — counts, not full product data.
  async getAlertCounts() {
    const summaries = await getAllSummaries(new Date());

    return summaries.reduce(
      (counts, s) => ({
        lowStockCount: counts.lowStockCount + (s.stockStatus === "LOW" ? 1 : 0),
        outOfStockCount: counts.outOfStockCount + (s.stockStatus === "OUT" ? 1 : 0),
        expiringSoonCount: counts.expiringSoonCount + (s.expiringSoonCount > 0 ? 1 : 0),
        expiredCount: counts.expiredCount + (s.expiredCount > 0 ? 1 : 0),
      }),
      { lowStockCount: 0, outOfStockCount: 0, expiringSoonCount: 0, expiredCount: 0 }
    );
  },

  // Backs the Dashboard's expiring-soon alert list — batch-level (not
  // per-product) so staff see exactly which batch to check.
  async getExpiringBatches({ days = 30, limit = 10 } = {}) {
    const now = new Date();
    const until = new Date(now.getTime() + days * 24 * 60 * 60 * 1000);

    const batches = await prisma.batch.findMany({
      where: { quantityRemaining: { gt: 0 }, expiryDate: { gte: now, lte: until } },
      include: { product: { select: { id: true, name: true } } },
      orderBy: { expiryDate: "asc" },
      take: limit,
    });

    return batches.map((batch) => ({
      id: batch.id,
      batchNumber: batch.batchNumber,
      product: batch.product,
      expiryDate: batch.expiryDate,
      quantityRemaining: batch.quantityRemaining,
    }));
  },

  async getProductBatches(productId) {
    const product = await prisma.product.findUnique({ where: { id: productId } });
    if (!product) throw new NotFoundError("Product");

    const now = new Date();
    const batches = await prisma.batch.findMany({
      where: { productId, quantityRemaining: { gt: 0 } },
      include: { stockIn: { include: { supplier: { select: SUPPLIER_SELECT } } } },
      orderBy: { expiryDate: "asc" },
    });

    return batches.map((batch) => ({
      id: batch.id,
      batchNumber: batch.batchNumber,
      expiryDate: batch.expiryDate,
      quantityRemaining: batch.quantityRemaining,
      costPricePerUnit: Number(batch.costPricePerUnit),
      supplier: batch.stockIn.supplier,
      status: computeBatchStatus(batch.expiryDate, now),
    }));
  },

  /**
   * Sum of quantityRemaining across non-expired batches only — deliberately
   * different from getSummary's totalRemaining, which includes expired
   * batches so staff can see they exist. This is what POS (Phase 6) checks
   * before letting a cashier add to cart: expired stock is never sellable.
   */
  async getSellableStock(productId) {
    const product = await prisma.product.findUnique({ where: { id: productId } });
    if (!product) throw new NotFoundError("Product");

    const result = await prisma.batch.aggregate({
      where: { productId, quantityRemaining: { gt: 0 }, expiryDate: { gte: new Date() } },
      _sum: { quantityRemaining: true },
    });

    return result._sum.quantityRemaining ?? 0;
  },

  // `client` defaults to the module-level `prisma` but accepts a
  // transaction's `tx` client too — Phase 7's checkout calls this inside
  // `prisma.$transaction()` so the allocation and the batch decrements
  // it informs happen against the same consistent transactional view.
  async getFefoAllocation(productId, quantity, client = prisma) {
    const product = await client.product.findUnique({ where: { id: productId } });
    if (!product) throw new NotFoundError("Product");

    const now = new Date();
    const batches = await client.batch.findMany({
      where: { productId, quantityRemaining: { gt: 0 }, expiryDate: { gte: now } },
      orderBy: { expiryDate: "asc" },
    });

    const allocations = [];
    let remaining = quantity;
    for (const batch of batches) {
      if (remaining <= 0) break;
      const quantityToTake = Math.min(remaining, batch.quantityRemaining);
      allocations.push({
        batchId: batch.id,
        batchNumber: batch.batchNumber,
        expiryDate: batch.expiryDate,
        quantityToTake,
      });
      remaining -= quantityToTake;
    }

    const totalAllocated = quantity - remaining;
    return {
      productId,
      requested: quantity,
      allocations,
      totalAllocated,
      sufficient: remaining === 0,
    };
  },
};
