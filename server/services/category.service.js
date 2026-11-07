import { prisma } from "@/lib/prisma";
import { createLogger } from "@/lib/logger";
import { NotFoundError, ConflictError } from "@/lib/errors";

const log = createLogger("services/category-service");

function toSafeCategory(category) {
  return {
    id: category.id,
    name: category.name,
    description: category.description,
    isActive: category.isActive,
    createdAt: category.createdAt,
  };
}

async function assertNameAvailable(name, excludeId) {
  const existing = await prisma.category.findFirst({
    where: {
      name: { equals: name, mode: "insensitive" },
      ...(excludeId ? { id: { not: excludeId } } : {}),
    },
  });
  if (existing) {
    throw new ConflictError("A category with this name already exists");
  }
}

export const categoryService = {
  async list({ search, isActive } = {}) {
    const categories = await prisma.category.findMany({
      where: {
        ...(search ? { name: { contains: search, mode: "insensitive" } } : {}),
        ...(isActive !== undefined ? { isActive: isActive === "true" } : {}),
      },
      orderBy: { name: "asc" },
    });
    return categories.map(toSafeCategory);
  },

  async getById(id) {
    const category = await prisma.category.findUnique({ where: { id } });
    if (!category) throw new NotFoundError("Category");
    return toSafeCategory(category);
  },

  async create({ name, description }) {
    await assertNameAvailable(name);
    const category = await prisma.category.create({ data: { name, description } });
    log.info("Category created", { categoryId: category.id });
    return toSafeCategory(category);
  },

  async update(id, data) {
    const existing = await prisma.category.findUnique({ where: { id } });
    if (!existing) throw new NotFoundError("Category");

    if (data.name && data.name !== existing.name) {
      await assertNameAvailable(data.name, id);
    }

    const category = await prisma.category.update({ where: { id }, data });
    log.info("Category updated", { categoryId: category.id });
    return toSafeCategory(category);
  },
};
