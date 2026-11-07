import { z } from "zod";

export const createManufacturerSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(120),
  description: z.string().trim().max(500).optional().nullable(),
});

export const updateManufacturerSchema = createManufacturerSchema.partial().extend({
  isActive: z.boolean().optional(),
});

export const listManufacturersQuerySchema = z.object({
  search: z.string().trim().optional(),
  isActive: z.enum(["true", "false"]).optional(),
});
