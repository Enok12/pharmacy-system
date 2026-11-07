import { apiSuccess } from "@/lib/api-response";
import { withApiHandler } from "@/lib/api-handler";
import { validateBody, validateQuery } from "@/lib/validate";
import { requireAuth, requireRole } from "@/lib/auth";
import {
  createManufacturerSchema,
  listManufacturersQuerySchema,
} from "@/validations/manufacturer.schema";
import { manufacturerService } from "@/services/manufacturer.service";

export const GET = withApiHandler(async (request) => {
  await requireAuth();

  const { searchParams } = new URL(request.url);
  const query = validateQuery(searchParams, listManufacturersQuerySchema);

  const manufacturers = await manufacturerService.list(query);
  return apiSuccess({ manufacturers });
}, "manufacturers/GET");

export const POST = withApiHandler(async (request) => {
  const authUser = await requireAuth();
  requireRole(authUser, ["ADMIN", "PHARMACIST"]);

  const body = await validateBody(request, createManufacturerSchema);
  const manufacturer = await manufacturerService.create(body);

  return apiSuccess({ manufacturer }, "Manufacturer created", 201);
}, "manufacturers/POST");
