import { z } from "zod";

const ROLES = ["ADMIN", "PHARMACIST", "CASHIER"];

export const createUserSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(120),
  email: z.string().trim().toLowerCase().email("Enter a valid email address"),
  password: z.string().min(8, "Password must be at least 8 characters"),
  role: z.enum(ROLES).default("CASHIER"),
});
