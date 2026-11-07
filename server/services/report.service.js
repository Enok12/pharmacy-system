import { prisma } from "@/lib/prisma";

const CATEGORY_SELECT = { name: true };
const PRODUCT_SELECT = { id: true, name: true };

function dateKey(date) {
  return date.toISOString().slice(0, 10);
}

function defaultRange({ from, to }) {
  const rangeTo = to ?? new Date();
  const rangeFrom = from ?? new Date(rangeTo.getTime() - 29 * 24 * 60 * 60 * 1000);
  return { from: rangeFrom, to: rangeTo };
}

export const reportService = {
  // Revenue/tax/cost/profit over a date range. `cost` is derived from
  // each sale item's original FEFO allocation (SaleItemBatch -> Batch,
  // Phase 7), the same snapshot-based cost basis Batch already carries.
  // Deliberately does not net out SaleReturn refunds — see Phase 9 plan.
  async getSalesReport({ from, to } = {}) {
    const range = defaultRange({ from, to });

    const sales = await prisma.sale.findMany({
      where: { createdAt: { gte: range.from, lte: range.to } },
      include: {
        items: {
          include: {
            batchAllocations: { include: { batch: { select: { costPricePerUnit: true } } } },
          },
        },
      },
      orderBy: { createdAt: "asc" },
    });

    const daily = new Map();

    const totals = { revenue: 0, tax: 0, cost: 0, profit: 0, saleCount: sales.length };

    for (const sale of sales) {
      const revenue = Number(sale.subtotal);
      const tax = Number(sale.tax);
      const cost = sale.items.reduce(
        (sum, item) =>
          sum +
          item.batchAllocations.reduce(
            (allocSum, alloc) => allocSum + alloc.quantity * Number(alloc.batch.costPricePerUnit),
            0
          ),
        0
      );
      const profit = revenue - cost;

      totals.revenue += revenue;
      totals.tax += tax;
      totals.cost += cost;
      totals.profit += profit;

      const key = dateKey(sale.createdAt);
      const bucket = daily.get(key) ?? { date: key, revenue: 0, profit: 0, saleCount: 0 };
      bucket.revenue += revenue;
      bucket.profit += profit;
      bucket.saleCount += 1;
      daily.set(key, bucket);
    }

    return {
      from: range.from,
      to: range.to,
      totals,
      daily: Array.from(daily.values()).sort((a, b) => (a.date < b.date ? -1 : 1)),
    };
  },

  // Point-in-time — no date range. Cost value uses each batch's own
  // snapshotted costPricePerUnit (Phase 4); retail value uses the
  // product's current sellingPrice (which may differ from what any
  // individual batch would actually sell at, same current-price
  // assumption CartItem already makes).
  async getInventoryValuation() {
    const batches = await prisma.batch.findMany({
      where: { quantityRemaining: { gt: 0 } },
      include: {
        product: {
          select: { id: true, name: true, sellingPrice: true, category: { select: CATEGORY_SELECT } },
        },
      },
    });

    const byProduct = new Map();
    for (const batch of batches) {
      const key = batch.productId;
      const entry = byProduct.get(key) ?? {
        product: { id: batch.product.id, name: batch.product.name },
        category: batch.product.category.name,
        quantityRemaining: 0,
        costValue: 0,
        retailValue: 0,
      };
      entry.quantityRemaining += batch.quantityRemaining;
      entry.costValue += batch.quantityRemaining * Number(batch.costPricePerUnit);
      entry.retailValue += batch.quantityRemaining * Number(batch.product.sellingPrice);
      byProduct.set(key, entry);
    }

    const products = Array.from(byProduct.values()).sort((a, b) => b.costValue - a.costValue);
    const totals = products.reduce(
      (sum, p) => ({ costValue: sum.costValue + p.costValue, retailValue: sum.retailValue + p.retailValue }),
      { costValue: 0, retailValue: 0 }
    );

    return { products, totals };
  },

  async getTopProducts({ from, to, limit = 10 } = {}) {
    const range = defaultRange({ from, to });

    const grouped = await prisma.saleItem.groupBy({
      by: ["productId"],
      where: { sale: { createdAt: { gte: range.from, lte: range.to } } },
      _sum: { quantity: true, lineTotal: true },
      orderBy: { _sum: { lineTotal: "desc" } },
      take: limit,
    });

    if (grouped.length === 0) return [];

    const products = await prisma.product.findMany({
      where: { id: { in: grouped.map((g) => g.productId) } },
      select: PRODUCT_SELECT,
    });
    const productsById = new Map(products.map((p) => [p.id, p]));

    return grouped.map((g) => ({
      product: productsById.get(g.productId),
      quantitySold: g._sum.quantity ?? 0,
      revenue: Number(g._sum.lineTotal ?? 0),
    }));
  },
};
