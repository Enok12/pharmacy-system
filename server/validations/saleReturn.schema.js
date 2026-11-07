import { z } from "zod";

const returnItemSchema = z.object({
  saleItemId: z.string().trim().min(1, "Sale item is required"),
  quantity: z.coerce.number().int().positive("Quantity must be greater than 0"),
  restock: z.boolean().default(true),
});

export const createSaleReturnSchema = z.object({
  saleId: z.string().trim().min(1, "Sale is required"),
  reason: z.string().trim().max(500).optional().nullable(),
  refundMethod: z.enum(["CASH", "CARD"]),
  items: z.array(returnItemSchema).min(1, "Add at least one item to return"),
});

export const listSaleReturnsQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().positive().max(100).default(20),
});
