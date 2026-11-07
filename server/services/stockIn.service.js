import { prisma } from "@/lib/prisma";
import { createLogger } from "@/lib/logger";
import { NotFoundError, ValidationError } from "@/lib/errors";

const log = createLogger("services/stock-in-service");

const SUPPLIER_SELECT = { id: true, name: true };
const RECEIVED_BY_SELECT = { id: true, name: true };
const PRODUCT_SELECT = { id: true, name: true };

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
  };
}

function toSafeStockIn(stockIn) {
  return {
    id: stockIn.id,
    supplier: stockIn.supplier,
    referenceNumber: stockIn.referenceNumber,
    receivedBy: stockIn.receivedBy,
    receivedAt: stockIn.receivedAt,
    notes: stockIn.notes,
    createdAt: stockIn.createdAt,
    ...(stockIn.batches ? { batches: stockIn.batches.map(toSafeBatch) } : {}),
    ...(stockIn._count ? { itemCount: stockIn._count.batches } : {}),
  };
}

async function assertSupplierExists(supplierId) {
  const supplier = await prisma.supplier.findUnique({ where: { id: supplierId } });
  if (!supplier) {
    throw new ValidationError("Validation failed", [
      { field: "supplierId", message: "Supplier not found" },
    ]);
  }
}

async function assertProductsExist(items) {
  const productIds = [...new Set(items.map((item) => item.productId))];
  const found = await prisma.product.findMany({
    where: { id: { in: productIds } },
    select: { id: true },
  });
  const foundIds = new Set(found.map((p) => p.id));

  items.forEach((item, index) => {
    if (!foundIds.has(item.productId)) {
      throw new ValidationError("Validation failed", [
        { field: `items[${index}].productId`, message: "Product not found" },
      ]);
    }
  });
}

export const stockInService = {
  async list({ supplierId, page = 1, pageSize = 20 } = {}) {
    const where = { ...(supplierId ? { supplierId } : {}) };

    const [stockIns, total] = await Promise.all([
      prisma.stockIn.findMany({
        where,
        include: {
          supplier: { select: SUPPLIER_SELECT },
          receivedBy: { select: RECEIVED_BY_SELECT },
          _count: { select: { batches: true } },
        },
        orderBy: { receivedAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.stockIn.count({ where }),
    ]);

    return { stockIns: stockIns.map(toSafeStockIn), total, page, pageSize };
  },

  async getById(id) {
    const stockIn = await prisma.stockIn.findUnique({
      where: { id },
      include: {
        supplier: { select: SUPPLIER_SELECT },
        receivedBy: { select: RECEIVED_BY_SELECT },
        batches: { include: { product: { select: PRODUCT_SELECT } } },
      },
    });
    if (!stockIn) throw new NotFoundError("Stock-in record");
    return toSafeStockIn(stockIn);
  },

  async create(receivedById, { supplierId, referenceNumber, receivedAt, notes, items }) {
    await assertSupplierExists(supplierId);
    await assertProductsExist(items);

    const stockIn = await prisma.stockIn.create({
      data: {
        supplierId,
        referenceNumber,
        receivedById,
        ...(receivedAt ? { receivedAt } : {}),
        notes,
        batches: {
          create: items.map((item) => ({
            productId: item.productId,
            batchNumber: item.batchNumber,
            expiryDate: item.expiryDate,
            manufacturingDate: item.manufacturingDate,
            quantityReceived: item.quantityReceived,
            quantityRemaining: item.quantityReceived,
            costPricePerUnit: item.costPricePerUnit,
          })),
        },
      },
      include: {
        supplier: { select: SUPPLIER_SELECT },
        receivedBy: { select: RECEIVED_BY_SELECT },
        batches: { include: { product: { select: PRODUCT_SELECT } } },
      },
    });

    log.info("Stock-in recorded", { stockInId: stockIn.id, itemCount: items.length });
    return toSafeStockIn(stockIn);
  },
};
