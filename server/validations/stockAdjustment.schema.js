import { z } from "zod";

const REASONS = ["DAMAGED", "EXPIRED", "LOST_STOLEN", "COUNT_CORRECTION", "OTHER"];

export const createAdjustmentSchema = z.object({
  batchId: z.string().trim().min(1, "Batch is required"),
  quantityChange: z.coerce
    .number()
    .int()
    .refine((n) => n !== 0, "Quantity change cannot be zero"),
  reason: z.enum(REASONS),
  notes: z.string().trim().max(500).optional().nullable(),
});

export const listAdjustmentsQuerySchema = z.object({
  batchId: z.string().trim().optional(),
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().positive().max(100).default(20),
});
