import { prisma } from "@/lib/prisma";
import { inventoryService } from "./inventory.service";

function startOfToday() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

function startOfMonth() {
  const d = new Date();
  d.setDate(1);
  d.setHours(0, 0, 0, 0);
  return d;
}

function toSaleAggregate(agg) {
  return { count: agg._count, total: Number(agg._sum.total ?? 0) };
}

function dateKey(date) {
  return date.toISOString().slice(0, 10);
}

export const dashboardService = {
  // Role-aware: a Cashier sees only their own sales-today figure; an
  // Admin/Pharmacist sees store-wide figures plus inventory value. Both
  // always get the low-stock/expiring alert counts, since those are
  // already fully open to every role on the Inventory page (Phase 5).
  async getStats({ requesterId, requesterRole }) {
    const alertCounts = await inventoryService.getAlertCounts();

    if (requesterRole === "CASHIER") {
      const mySalesToday = await prisma.sale.aggregate({
        where: { cashierId: requesterId, createdAt: { gte: startOfToday() } },
        _count: true,
        _sum: { total: true },
      });
      return { ...alertCounts, mySalesToday: toSaleAggregate(mySalesToday) };
    }

    const [todaysSales, monthSales, batches] = await Promise.all([
      prisma.sale.aggregate({
        where: { createdAt: { gte: startOfToday() } },
        _count: true,
        _sum: { total: true },
      }),
      prisma.sale.aggregate({
        where: { createdAt: { gte: startOfMonth() } },
        _count: true,
        _sum: { total: true },
      }),
      prisma.batch.findMany({
        where: { quantityRemaining: { gt: 0 } },
        select: { quantityRemaining: true, costPricePerUnit: true },
      }),
    ]);

    const inventoryValue = batches.reduce(
      (sum, b) => sum + b.quantityRemaining * Number(b.costPricePerUnit),
      0
    );

    return {
      ...alertCounts,
      todaysSales: toSaleAggregate(todaysSales),
      monthRevenue: toSaleAggregate(monthSales).total,
      inventoryValue,
    };
  },

  // Store-wide only — the route restricts this to Admin/Pharmacist.
  //
  // Bucket boundaries are computed in UTC, not local time, to stay
  // consistent with dateKey() (which reads the UTC date out of a
  // Sale.createdAt timestamp via toISOString()) — local-time boundaries
  // shifted every bucket's key by a day whenever the server's timezone
  // was ahead of UTC, silently dropping "today"'s sales from the chart.
  async getSalesTrend({ days = 14 } = {}) {
    const now = new Date();
    const since = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
    since.setUTCDate(since.getUTCDate() - (days - 1));

    const sales = await prisma.sale.findMany({
      where: { createdAt: { gte: since } },
      select: { createdAt: true, total: true },
    });

    const buckets = new Map();
    for (let i = 0; i < days; i++) {
      const d = new Date(since);
      d.setUTCDate(d.getUTCDate() + i);
      buckets.set(dateKey(d), { date: dateKey(d), revenue: 0, salesCount: 0 });
    }

    for (const sale of sales) {
      const key = dateKey(sale.createdAt);
      const bucket = buckets.get(key);
      if (!bucket) continue;
      bucket.revenue += Number(sale.total);
      bucket.salesCount += 1;
    }

    return Array.from(buckets.values());
  },

  async getAlerts({ lowStockLimit = 5, expiringLimit = 5 } = {}) {
    const [out, low, expiringSoon] = await Promise.all([
      inventoryService.getSummary({ stockStatus: "OUT", pageSize: lowStockLimit }),
      inventoryService.getSummary({ stockStatus: "LOW", pageSize: lowStockLimit }),
      inventoryService.getExpiringBatches({ limit: expiringLimit }),
    ]);

    const lowStock = [...out.products, ...low.products].slice(0, lowStockLimit).map((p) => ({
      id: p.id,
      name: p.name,
      totalRemaining: p.totalRemaining,
      reorderLevel: p.reorderLevel,
      stockStatus: p.stockStatus,
    }));

    return { lowStock, expiringSoon };
  },
};
