import { z } from "zod";

export const salesTrendQuerySchema = z.object({
  days: z.coerce.number().int().positive().max(90).default(14),
});
