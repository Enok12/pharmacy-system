import { prisma } from "@/lib/prisma";
import { createLogger } from "@/lib/logger";
import { NotFoundError, ConflictError } from "@/lib/errors";

const log = createLogger("services/manufacturer-service");

function toSafeManufacturer(manufacturer) {
  return {
    id: manufacturer.id,
    name: manufacturer.name,
    description: manufacturer.description,
    isActive: manufacturer.isActive,
    createdAt: manufacturer.createdAt,
  };
}

async function assertNameAvailable(name, excludeId) {
  const existing = await prisma.manufacturer.findFirst({
    where: {
      name: { equals: name, mode: "insensitive" },
      ...(excludeId ? { id: { not: excludeId } } : {}),
    },
  });
  if (existing) {
    throw new ConflictError("A manufacturer with this name already exists");
  }
}

export const manufacturerService = {
  async list({ search, isActive } = {}) {
    const manufacturers = await prisma.manufacturer.findMany({
      where: {
        ...(search ? { name: { contains: search, mode: "insensitive" } } : {}),
        ...(isActive !== undefined ? { isActive: isActive === "true" } : {}),
      },
      orderBy: { name: "asc" },
    });
    return manufacturers.map(toSafeManufacturer);
  },

  async getById(id) {
    const manufacturer = await prisma.manufacturer.findUnique({ where: { id } });
    if (!manufacturer) throw new NotFoundError("Manufacturer");
    return toSafeManufacturer(manufacturer);
  },

  async create({ name, description }) {
    await assertNameAvailable(name);
    const manufacturer = await prisma.manufacturer.create({ data: { name, description } });
    log.info("Manufacturer created", { manufacturerId: manufacturer.id });
    return toSafeManufacturer(manufacturer);
  },

  async update(id, data) {
    const existing = await prisma.manufacturer.findUnique({ where: { id } });
    if (!existing) throw new NotFoundError("Manufacturer");

    if (data.name && data.name !== existing.name) {
      await assertNameAvailable(data.name, id);
    }

    const manufacturer = await prisma.manufacturer.update({ where: { id }, data });
    log.info("Manufacturer updated", { manufacturerId: manufacturer.id });
    return toSafeManufacturer(manufacturer);
  },
};
