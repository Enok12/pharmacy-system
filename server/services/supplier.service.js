import { prisma } from "@/lib/prisma";
import { createLogger } from "@/lib/logger";
import { NotFoundError, ConflictError } from "@/lib/errors";

const log = createLogger("services/supplier-service");

function toSafeSupplier(supplier) {
  return {
    id: supplier.id,
    name: supplier.name,
    contactPerson: supplier.contactPerson,
    phone: supplier.phone,
    email: supplier.email,
    address: supplier.address,
    isActive: supplier.isActive,
    createdAt: supplier.createdAt,
  };
}

async function assertNameAvailable(name, excludeId) {
  const existing = await prisma.supplier.findFirst({
    where: {
      name: { equals: name, mode: "insensitive" },
      ...(excludeId ? { id: { not: excludeId } } : {}),
    },
  });
  if (existing) {
    throw new ConflictError("A supplier with this name already exists");
  }
}

export const supplierService = {
  async list({ search, isActive } = {}) {
    const suppliers = await prisma.supplier.findMany({
      where: {
        ...(search ? { name: { contains: search, mode: "insensitive" } } : {}),
        ...(isActive !== undefined ? { isActive: isActive === "true" } : {}),
      },
      orderBy: { name: "asc" },
    });
    return suppliers.map(toSafeSupplier);
  },

  async getById(id) {
    const supplier = await prisma.supplier.findUnique({ where: { id } });
    if (!supplier) throw new NotFoundError("Supplier");
    return toSafeSupplier(supplier);
  },

  async create({ name, contactPerson, phone, email, address }) {
    await assertNameAvailable(name);
    const supplier = await prisma.supplier.create({
      data: { name, contactPerson, phone, email: email || null, address },
    });
    log.info("Supplier created", { supplierId: supplier.id });
    return toSafeSupplier(supplier);
  },

  async update(id, data) {
    const existing = await prisma.supplier.findUnique({ where: { id } });
    if (!existing) throw new NotFoundError("Supplier");

    if (data.name && data.name !== existing.name) {
      await assertNameAvailable(data.name, id);
    }

    const supplier = await prisma.supplier.update({
      where: { id },
      data: { ...data, email: data.email === "" ? null : data.email },
    });
    log.info("Supplier updated", { supplierId: supplier.id });
    return toSafeSupplier(supplier);
  },
};
