import { prisma } from "@/lib/prisma";
import { createLogger } from "@/lib/logger";
import { NotFoundError, ValidationError } from "@/lib/errors";

const log = createLogger("services/sale-return-service");

const CASHIER_SELECT = { id: true, name: true };
const SALE_SELECT = { id: true, saleNumber: true };
const PROCESSED_BY_SELECT = { id: true, name: true };

function toSafeReturnItem(item) {
  return {
    id: item.id,
    saleItem: item.saleItem
      ? { id: item.saleItem.id, productId: item.saleItem.productId, productName: item.saleItem.productName }
      : undefined,
    quantity: item.quantity,
    restocked: item.restocked,
    refundAmount: Number(item.refundAmount),
    createdAt: item.createdAt,
  };
}

function toSafeSaleReturn(saleReturn) {
  return {
    id: saleReturn.id,
    sale: saleReturn.sale,
    processedBy: saleReturn.processedBy,
    reason: saleReturn.reason,
    refundAmount: Number(saleReturn.refundAmount),
    refundMethod: saleReturn.refundMethod,
    createdAt: saleReturn.createdAt,
    ...(saleReturn.items ? { items: saleReturn.items.map(toSafeReturnItem) } : {}),
    ...(saleReturn._count ? { itemCount: saleReturn._count.items } : {}),
  };
}

async function fetchFullReturn(id, client = prisma) {
  return client.saleReturn.findUnique({
    where: { id },
    include: {
      sale: { select: SALE_SELECT },
      processedBy: { select: PROCESSED_BY_SELECT },
      items: { include: { saleItem: { select: { id: true, productId: true, productName: true } } } },
    },
  });
}

// `client` defaults to the module-level `prisma` but accepts a transaction's
// `tx` client — `create` below calls this inside `prisma.$transaction()` so
// the over-return check and the writes it informs see the same consistent view.
async function computeReturnable(saleId, client = prisma) {
  const sale = await client.sale.findUnique({
    where: { id: saleId },
    include: { cashier: { select: CASHIER_SELECT }, items: true },
  });
  if (!sale) throw new NotFoundError("Sale");

  const saleItemIds = sale.items.map((item) => item.id);
  const returnedRows = await client.saleReturnItem.groupBy({
    by: ["saleItemId"],
    where: { saleItemId: { in: saleItemIds } },
    _sum: { quantity: true },
  });
  const returnedMap = new Map(returnedRows.map((row) => [row.saleItemId, row._sum.quantity ?? 0]));

  return {
    id: sale.id,
    saleNumber: sale.saleNumber,
    cashier: sale.cashier,
    paymentMethod: sale.paymentMethod,
    total: Number(sale.total),
    createdAt: sale.createdAt,
    items: sale.items.map((item) => {
      const returnedQuantity = returnedMap.get(item.id) ?? 0;
      return {
        id: item.id,
        product: { id: item.productId, name: item.productName },
        quantity: item.quantity,
        unitPrice: Number(item.unitPrice),
        taxRate: Number(item.taxRate),
        returnedQuantity,
        returnableQuantity: item.quantity - returnedQuantity,
      };
    }),
  };
}

// Restocks a returned line by walking its original FEFO allocation
// (SaleItemBatch, Phase 7) in reverse — most-recently-allocated (latest
// expiry) batch first — capping each batch's add-back at its original
// contribution minus whatever prior returns of this same line already
// restocked to it. Keeps a second partial return from over-restocking.
async function restockReturnItem(tx, { saleReturnItemId, saleItemId, quantity }) {
  const [allocations, restockedRows] = await Promise.all([
    tx.saleItemBatch.findMany({
      where: { saleItemId },
      include: { batch: { select: { id: true, expiryDate: true } } },
    }),
    tx.saleReturnItemBatch.findMany({
      where: { saleReturnItem: { saleItemId } },
      select: { batchId: true, quantity: true },
    }),
  ]);

  const restockedTotals = new Map();
  for (const row of restockedRows) {
    restockedTotals.set(row.batchId, (restockedTotals.get(row.batchId) ?? 0) + row.quantity);
  }

  const sorted = [...allocations].sort((a, b) => b.batch.expiryDate - a.batch.expiryDate);

  let remaining = quantity;
  for (const alloc of sorted) {
    if (remaining <= 0) break;
    const alreadyRestocked = restockedTotals.get(alloc.batchId) ?? 0;
    const headroom = alloc.quantity - alreadyRestocked;
    if (headroom <= 0) continue;

    const toRestock = Math.min(remaining, headroom);
    await tx.saleReturnItemBatch.create({
      data: { saleReturnItemId, batchId: alloc.batchId, quantity: toRestock },
    });
    await tx.batch.update({
      where: { id: alloc.batchId },
      data: { quantityRemaining: { increment: toRestock } },
    });
    remaining -= toRestock;
  }
}

export const saleReturnService = {
  async getReturnableSale(saleId) {
    return computeReturnable(saleId);
  },

  async create(processedById, { saleId, reason, refundMethod, items }) {
    const returnId = await prisma.$transaction(async (tx) => {
      const returnable = await computeReturnable(saleId, tx);
      const returnableMap = new Map(returnable.items.map((item) => [item.id, item]));

      const lines = items.map((requested, index) => {
        const saleItem = returnableMap.get(requested.saleItemId);
        if (!saleItem) {
          throw new ValidationError("Validation failed", [
            { field: `items[${index}].saleItemId`, message: "Sale item not found on this sale" },
          ]);
        }
        if (requested.quantity > saleItem.returnableQuantity) {
          throw new ValidationError("Validation failed", [
            {
              field: `items[${index}].quantity`,
              message: `${saleItem.product.name}: only ${saleItem.returnableQuantity} returnable`,
            },
          ]);
        }
        const refundAmount = requested.quantity * saleItem.unitPrice * (1 + saleItem.taxRate / 100);
        return { ...requested, refundAmount };
      });

      const totalRefund = lines.reduce((sum, line) => sum + line.refundAmount, 0);

      const saleReturn = await tx.saleReturn.create({
        data: { saleId, processedById, reason, refundAmount: totalRefund, refundMethod },
      });

      for (const line of lines) {
        const returnItem = await tx.saleReturnItem.create({
          data: {
            saleReturnId: saleReturn.id,
            saleItemId: line.saleItemId,
            quantity: line.quantity,
            restocked: line.restock,
            refundAmount: line.refundAmount,
          },
        });

        if (line.restock) {
          await restockReturnItem(tx, {
            saleReturnItemId: returnItem.id,
            saleItemId: line.saleItemId,
            quantity: line.quantity,
          });
        }
      }

      return saleReturn.id;
    });

    log.info("Sale return processed", { returnId, saleId, processedById });
    return toSafeSaleReturn(await fetchFullReturn(returnId));
  },

  async list({ page = 1, pageSize = 20 } = {}) {
    const [returns, total] = await Promise.all([
      prisma.saleReturn.findMany({
        include: {
          sale: { select: SALE_SELECT },
          processedBy: { select: PROCESSED_BY_SELECT },
          _count: { select: { items: true } },
        },
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.saleReturn.count(),
    ]);

    return { returns: returns.map(toSafeSaleReturn), total, page, pageSize };
  },

  async getById(id) {
    const saleReturn = await fetchFullReturn(id);
    if (!saleReturn) throw new NotFoundError("Sale return");
    return toSafeSaleReturn(saleReturn);
  },
};
