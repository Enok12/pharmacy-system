import { prisma } from "@/lib/prisma";
import { createLogger } from "@/lib/logger";
import { NotFoundError, ValidationError } from "@/lib/errors";
import { inventoryService } from "./inventory.service";

const log = createLogger("services/sale-service");

const CASHIER_SELECT = { id: true, name: true };
const PRODUCT_SELECT = { id: true, name: true, sellingPrice: true, taxRate: true, isActive: true };

function toSafeSale(sale) {
  return {
    id: sale.id,
    saleNumber: sale.saleNumber,
    cashier: sale.cashier,
    subtotal: Number(sale.subtotal),
    tax: Number(sale.tax),
    total: Number(sale.total),
    paymentMethod: sale.paymentMethod,
    amountTendered: sale.amountTendered === null ? null : Number(sale.amountTendered),
    changeDue: sale.changeDue === null ? null : Number(sale.changeDue),
    createdAt: sale.createdAt,
    ...(sale.items
      ? {
          items: sale.items.map((item) => ({
            id: item.id,
            product: { id: item.productId, name: item.productName },
            quantity: item.quantity,
            unitPrice: Number(item.unitPrice),
            taxRate: Number(item.taxRate),
            lineSubtotal: Number(item.lineSubtotal),
            lineTax: Number(item.lineTax),
            lineTotal: Number(item.lineTotal),
          })),
        }
      : {}),
    ...(sale._count ? { itemCount: sale._count.items } : {}),
  };
}

async function fetchFullSale(id) {
  return prisma.sale.findUnique({
    where: { id },
    include: { cashier: { select: CASHIER_SELECT }, items: true },
  });
}

export const saleService = {
  // `items` — [{ productId, quantity }] — comes straight from the
  // client's own cart state (no server-side cart anymore; see the
  // "drop DB-backed cart" plan). Everything downstream of building
  // `lines` — the FEFO re-validation and the atomic Sale/SaleItem/
  // SaleItemBatch creation — is unchanged: checkout was always the real
  // enforcement point regardless of where the line items came from.
  async checkout(userId, { paymentMethod, amountTendered, items }) {
    const productIds = [...new Set(items.map((item) => item.productId))];
    const products = await prisma.product.findMany({
      where: { id: { in: productIds } },
      select: PRODUCT_SELECT,
    });
    const productsById = new Map(products.map((p) => [p.id, p]));

    items.forEach((item, index) => {
      const product = productsById.get(item.productId);
      if (!product || !product.isActive) {
        throw new ValidationError("Validation failed", [
          { field: `items[${index}].productId`, message: "Product not found" },
        ]);
      }
    });

    const lines = items.map((item) => {
      const product = productsById.get(item.productId);
      const unitPrice = Number(product.sellingPrice);
      const taxRate = Number(product.taxRate);
      const lineSubtotal = item.quantity * unitPrice;
      const lineTax = (lineSubtotal * taxRate) / 100;
      return {
        productId: item.productId,
        productName: product.name,
        quantity: item.quantity,
        unitPrice,
        taxRate,
        lineSubtotal,
        lineTax,
        lineTotal: lineSubtotal + lineTax,
      };
    });

    const subtotal = lines.reduce((sum, l) => sum + l.lineSubtotal, 0);
    const tax = lines.reduce((sum, l) => sum + l.lineTax, 0);
    const total = subtotal + tax;

    let changeDue = null;
    if (paymentMethod === "CASH") {
      if (amountTendered < total) {
        throw new ValidationError("Validation failed", [
          { field: "amountTendered", message: "Amount tendered is less than the total due" },
        ]);
      }
      changeDue = amountTendered - total;
    }

    const saleId = await prisma.$transaction(async (tx) => {
      // Re-validate stock inside the transaction — this is the only
      // stock check that exists (the client-side cart has none; see the
      // "drop DB-backed cart" plan). Nothing is written if any line is short.
      const allocationsByLine = [];
      for (const line of lines) {
        const allocation = await inventoryService.getFefoAllocation(line.productId, line.quantity, tx);
        if (!allocation.sufficient) {
          throw new ValidationError("Validation failed", [
            { field: "quantity", message: `${line.productName}: only ${allocation.totalAllocated} in stock` },
          ]);
        }
        allocationsByLine.push(allocation);
      }

      const sale = await tx.sale.create({
        data: {
          cashierId: userId,
          subtotal,
          tax,
          total,
          paymentMethod,
          amountTendered: paymentMethod === "CASH" ? amountTendered : null,
          changeDue,
        },
      });

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const allocation = allocationsByLine[i];

        const saleItem = await tx.saleItem.create({
          data: {
            saleId: sale.id,
            productId: line.productId,
            productName: line.productName,
            quantity: line.quantity,
            unitPrice: line.unitPrice,
            taxRate: line.taxRate,
            lineSubtotal: line.lineSubtotal,
            lineTax: line.lineTax,
            lineTotal: line.lineTotal,
          },
        });

        for (const alloc of allocation.allocations) {
          await tx.saleItemBatch.create({
            data: { saleItemId: saleItem.id, batchId: alloc.batchId, quantity: alloc.quantityToTake },
          });
          await tx.batch.update({
            where: { id: alloc.batchId },
            data: { quantityRemaining: { decrement: alloc.quantityToTake } },
          });
        }
      }

      return sale.id;
    });

    log.info("Sale completed", { saleId, cashierId: userId, total });
    return toSafeSale(await fetchFullSale(saleId));
  },

  async list({ requesterId, requesterRole, saleNumber, page = 1, pageSize = 20 } = {}) {
    const where = {
      ...(requesterRole === "CASHIER" ? { cashierId: requesterId } : {}),
      ...(saleNumber ? { saleNumber } : {}),
    };

    const [sales, total] = await Promise.all([
      prisma.sale.findMany({
        where,
        include: { cashier: { select: CASHIER_SELECT }, _count: { select: { items: true } } },
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.sale.count({ where }),
    ]);

    return { sales: sales.map(toSafeSale), total, page, pageSize };
  },

  async getById(id, { requesterId, requesterRole }) {
    const sale = await fetchFullSale(id);
    if (!sale || (requesterRole === "CASHIER" && sale.cashierId !== requesterId)) {
      throw new NotFoundError("Sale");
    }
    return toSafeSale(sale);
  },
};
