import { apiSuccess } from "@/lib/api-response";
import { withApiHandler } from "@/lib/api-handler";
import { validateBody } from "@/lib/validate";
import { requireAuth, requireRole } from "@/lib/auth";
import { updateManufacturerSchema } from "@/validations/manufacturer.schema";
import { manufacturerService } from "@/services/manufacturer.service";

export const GET = withApiHandler(async (_request, { params }) => {
  await requireAuth();
  const { id } = await params;

  const manufacturer = await manufacturerService.getById(id);
  return apiSuccess({ manufacturer });
}, "manufacturers/[id]/GET");

export const PATCH = withApiHandler(async (request, { params }) => {
  const authUser = await requireAuth();
  requireRole(authUser, ["ADMIN", "PHARMACIST"]);
  const { id } = await params;

  const body = await validateBody(request, updateManufacturerSchema);
  const manufacturer = await manufacturerService.update(id, body);

  return apiSuccess({ manufacturer }, "Manufacturer updated");
}, "manufacturers/[id]/PATCH");
