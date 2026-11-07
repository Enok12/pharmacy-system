import { apiSuccess } from "@/lib/api-response";
import { withApiHandler } from "@/lib/api-handler";
import { prisma } from "@/lib/prisma";

/**
 * GET /api/v1/health
 * Confirms the API is reachable and the database connection + Prisma
 * client are working end-to-end. Used by Phase 1 testing checklist and
 * later by deployment health checks.
 */
export const GET = withApiHandler(async () => {
  let database = "unreachable";
  try {
    await prisma.$queryRaw`SELECT 1`;
    database = "connected";
  } catch {
    database = "unreachable";
  }

  return apiSuccess(
    {
      status: "ok",
      api: "v1",
      database,
      timestamp: new Date().toISOString(),
    },
    "Service is healthy"
  );
}, "health/GET");
