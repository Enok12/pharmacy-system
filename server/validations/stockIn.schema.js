import { z } from "zod";

const batchItemSchema = z.object({
  productId: z.string().trim().min(1, "Product is required"),
  batchNumber: z.string().trim().min(1, "Batch number is required").max(100),
  expiryDate: z.coerce.date({ message: "Enter a valid expiry date" }),
  manufacturingDate: z.coerce.date().optional().nullable(),
  quantityReceived: z.coerce.number().int().positive("Quantity must be greater than 0"),
  costPricePerUnit: z.coerce.number().nonnegative("Cost cannot be negative"),
});

export const createStockInSchema = z.object({
  supplierId: z.string().trim().min(1, "Supplier is required"),
  referenceNumber: z.string().trim().max(100).optional().nullable(),
  receivedAt: z.coerce.date().optional(),
  notes: z.string().trim().max(1000).optional().nullable(),
  items: z.array(batchItemSchema).min(1, "Add at least one product"),
});

export const listStockInsQuerySchema = z.object({
  supplierId: z.string().trim().optional(),
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().positive().max(100).default(20),
});

export const listBatchesQuerySchema = z.object({
  productId: z.string().trim().optional(),
  supplierId: z.string().trim().optional(),
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().positive().max(100).default(20),
});
