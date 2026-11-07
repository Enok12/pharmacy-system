import { z } from "zod";

const checkoutItemSchema = z.object({
  productId: z.string().trim().min(1, "Product is required"),
  quantity: z.coerce.number().int().positive("Quantity must be greater than 0"),
});

export const checkoutSchema = z
  .object({
    paymentMethod: z.enum(["CASH", "CARD"]),
    amountTendered: z.coerce.number().nonnegative().optional(),
    items: z.array(checkoutItemSchema).min(1, "Add at least one item"),
  })
  .refine((d) => d.paymentMethod !== "CASH" || d.amountTendered !== undefined, {
    message: "Amount tendered is required for cash payments",
    path: ["amountTendered"],
  });

export const listSalesQuerySchema = z.object({
  saleNumber: z.coerce.number().int().positive().optional(),
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().positive().max(100).default(20),
});
