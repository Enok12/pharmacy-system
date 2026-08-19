import { prisma } from "@/lib/prisma";
import { createLogger } from "@/lib/logger";
import { NotFoundError, ConflictError, ValidationError } from "@/lib/errors";

const log = createLogger("services/product-service");

function toSafeProduct(product) {
  return {
    id: product.id,
    name: product.name,
    genericName: product.genericName,
    category: product.category,
    manufacturer: product.manufacturer,
    unitOfMeasure: product.unitOfMeasure,
    barcode: product.barcode,
    costPrice: Number(product.costPrice),
    sellingPrice: Number(product.sellingPrice),
    taxRate: Number(product.taxRate),
    reorderLevel: product.reorderLevel,
    isActive: product.isActive,
    description: product.description,
    createdAt: product.createdAt,
  };
}

const CATEGORY_SELECT = { id: true, name: true };
const MANUFACTURER_SELECT = { id: true, name: true };

async function assertCategoryExists(categoryId) {
  const category = await prisma.category.findUnique({ where: { id: categoryId } });
  if (!category) {
    throw new ValidationError("Validation failed", [
      { field: "categoryId", message: "Category not found" },
    ]);
  }
}

async function assertManufacturerExists(manufacturerId) {
  const manufacturer = await prisma.manufacturer.findUnique({ where: { id: manufacturerId } });
  if (!manufacturer) {
    throw new ValidationError("Validation failed", [
      { field: "manufacturerId", message: "Manufacturer not found" },
    ]);
  }
}

async function assertBarcodeAvailable(barcode, excludeId) {
  if (!barcode) return;
  const existing = await prisma.product.findFirst({
    where: { barcode, ...(excludeId ? { id: { not: excludeId } } : {}) },
  });
  if (existing) {
    throw new ConflictError("A product with this barcode already exists");
  }
}

async function assertNameAvailable(name, manufacturerId, excludeId) {
  const existing = await prisma.product.findFirst({
    where: {
      name: { equals: name, mode: "insensitive" },
      manufacturerId,
      ...(excludeId ? { id: { not: excludeId } } : {}),
    },
  });
  if (existing) {
    throw new ConflictError("This manufacturer already has a product with this name");
  }
}

export const productService = {
  async list({ search, categoryId, manufacturerId, isActive, page = 1, pageSize = 20 } = {}) {
    const where = {
      ...(search
        ? {
            OR: [
              { name: { contains: search, mode: "insensitive" } },
              { genericName: { contains: search, mode: "insensitive" } },
              { barcode: { contains: search, mode: "insensitive" } },
            ],
          }
        : {}),
      ...(categoryId ? { categoryId } : {}),
      ...(manufacturerId ? { manufacturerId } : {}),
      ...(isActive !== undefined ? { isActive: isActive === "true" } : {}),
    };

    const [products, total] = await Promise.all([
      prisma.product.findMany({
        where,
        include: { category: { select: CATEGORY_SELECT }, manufacturer: { select: MANUFACTURER_SELECT } },
        orderBy: { name: "asc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.product.count({ where }),
    ]);

    return { products: products.map(toSafeProduct), total, page, pageSize };
  },

  async getById(id) {
    const product = await prisma.product.findUnique({
      where: { id },
      include: { category: { select: CATEGORY_SELECT }, manufacturer: { select: MANUFACTURER_SELECT } },
    });
    if (!product) throw new NotFoundError("Product");
    return toSafeProduct(product);
  },

  async create(data) {
    await assertCategoryExists(data.categoryId);
    await assertManufacturerExists(data.manufacturerId);
    await assertBarcodeAvailable(data.barcode);
    await assertNameAvailable(data.name, data.manufacturerId);

    const product = await prisma.product.create({
      data,
      include: { category: { select: CATEGORY_SELECT }, manufacturer: { select: MANUFACTURER_SELECT } },
    });
    log.info("Product created", { productId: product.id });
    return toSafeProduct(product);
  },

  async update(id, data) {
    const existing = await prisma.product.findUnique({ where: { id } });
    if (!existing) throw new NotFoundError("Product");

    if (data.categoryId) await assertCategoryExists(data.categoryId);
    if (data.manufacturerId) await assertManufacturerExists(data.manufacturerId);
    if (data.barcode && data.barcode !== existing.barcode) {
      await assertBarcodeAvailable(data.barcode, id);
    }
    if (data.name && data.name !== existing.name) {
      const manufacturerId = data.manufacturerId || existing.manufacturerId;
      await assertNameAvailable(data.name, manufacturerId, id);
    }

    const product = await prisma.product.update({
      where: { id },
      data,
      include: { category: { select: CATEGORY_SELECT }, manufacturer: { select: MANUFACTURER_SELECT } },
    });
    log.info("Product updated", { productId: product.id });
    return toSafeProduct(product);
  },
};
