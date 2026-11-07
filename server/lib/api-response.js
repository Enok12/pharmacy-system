import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { AppError } from "./errors";
import { createLogger } from "./logger";

const log = createLogger("api-response");

/**
 * Standard success envelope — every /api/v1 route returns this shape.
 * { "success": true, "message": "", "data": {} }
 */
export function apiSuccess(data = {}, message = "", status = 200) {
  return NextResponse.json({ success: true, message, data }, { status });
}

/**
 * Standard error envelope.
 * { "success": false, "message": "", "errors": [] }
 */
export function apiError(message = "Something went wrong", errors = [], status = 500) {
  return NextResponse.json({ success: false, message, errors }, { status });
}

/**
 * Converts any thrown error into the standard error envelope.
 *
 * Usage inside a route handler:
 *   try { ... } catch (err) { return handleApiError(err, "products/route"); }
 *
 * - AppError subclasses (see lib/errors.js) -> mapped to their intended
 *   status code, message and details are safe to expose.
 * - ZodError (raw, if a route validates inline) -> 422 with field errors.
 * - Anything else -> logged with full stack, client gets a generic 500.
 *   This is the boundary that prevents internal details (stack traces,
 *   SQL, file paths) from ever reaching the client.
 */
export function handleApiError(error, routeContext = "unknown") {
  if (error instanceof AppError) {
    if (error.statusCode >= 500) {
      log.error(error.message, { route: routeContext, stack: error.stack });
    }
    return apiError(error.message, error.errors, error.statusCode);
  }

  if (error instanceof ZodError) {
    const errors = error.issues.map((issue) => ({
      field: issue.path.join("."),
      message: issue.message,
    }));
    return apiError("Validation failed", errors, 422);
  }

  // Unexpected error: log full detail server-side, never leak it to the client.
  log.error("Unhandled error", {
    route: routeContext,
    message: error?.message,
    stack: error?.stack,
  });

  return apiError("An unexpected error occurred. Please try again.", [], 500);
}
