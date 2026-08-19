import { z } from "zod";

export const createSupplierSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(120),
  contactPerson: z.string().trim().max(120).optional().nullable(),
  phone: z.string().trim().max(30).optional().nullable(),
  email: z
    .string()
    .trim()
    .email("Enter a valid email address")
    .max(200)
    .optional()
    .nullable()
    .or(z.literal("")),
  address: z.string().trim().max(300).optional().nullable(),
});

export const updateSupplierSchema = createSupplierSchema.partial().extend({
  isActive: z.boolean().optional(),
});

export const listSuppliersQuerySchema = z.object({
  search: z.string().trim().optional(),
  isActive: z.enum(["true", "false"]).optional(),
});
