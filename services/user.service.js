import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { createLogger } from "@/lib/logger";
import { ConflictError } from "@/lib/errors";

const log = createLogger("services/user-service");

function toSafeUser(user) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    isActive: user.isActive,
    createdAt: user.createdAt,
  };
}

export const userService = {
  async list() {
    const users = await prisma.user.findMany({ orderBy: { createdAt: "asc" } });
    return users.map(toSafeUser);
  },

  async create({ name, email, password, role }) {
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      throw new ConflictError("A user with this email already exists");
    }

    const passwordHash = await bcrypt.hash(password, 12);
    const user = await prisma.user.create({
      data: { name, email, passwordHash, role },
    });

    log.info("User created", { userId: user.id, role: user.role });
    return toSafeUser(user);
  },
};
