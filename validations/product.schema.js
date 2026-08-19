import { z } from "zod";

export const UNITS_OF_MEASURE = [
  "TABLET",
  "CAPSULE",
  "BOTTLE",
  "VIAL",
  "TUBE",
  "BOX",
  "STRIP",
  "ML",
  "MG",
  "G",
  "UNIT",
];

export const createProductSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(200),
  genericName: z.string().trim().max(200).optional().nullable(),
  categoryId: z.string().trim().min(1, "Category is required"),
  manufacturerId: z.string().trim().min(1, "Manufacturer is required"),
  unitOfMeasure: z.enum(UNITS_OF_MEASURE),
  barcode: z.string().trim().min(1).max(64).optional().nullable(),
  costPrice: z.coerce.number().nonnegative("Cost price cannot be negative"),
  sellingPrice: z.coerce.number().nonnegative("Selling price cannot be negative"),
  taxRate: z.coerce.number().min(0).max(100).default(0),
  reorderLevel: z.coerce.number().int().nonnegative().default(0),
  description: z.string().trim().max(1000).optional().nullable(),
});

export const updateProductSchema = createProductSchema.partial().extend({
  isActive: z.boolean().optional(),
});

export const listProductsQuerySchema = z.object({
  search: z.string().trim().optional(),
  categoryId: z.string().trim().optional(),
  manufacturerId: z.string().trim().optional(),
  isActive: z.enum(["true", "false"]).optional(),
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().positive().max(100).default(20),
});
