import { z } from "zod";

export const listInventoryQuerySchema = z.object({
  search: z.string().trim().optional(),
  stockStatus: z.enum(["OUT", "LOW", "OK"]).optional(),
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().positive().max(100).default(20),
});

export const fefoQuerySchema = z.object({
  quantity: z.coerce.number().int().positive("Quantity must be greater than 0"),
});
