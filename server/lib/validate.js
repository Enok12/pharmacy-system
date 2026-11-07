import { ValidationError } from "./errors";

/**
 * Validation layer (Phase 1 foundation).
 *
 * Every write endpoint should validate its input against a Zod schema
 * (see /validations) before it ever reaches the service layer. This keeps
 * "is this request well-formed" separate from "is this request allowed to
 * happen" (business rules), which stays in services/.
 *
 * @example
 * const body = await validateBody(req, createProductSchema);
 */
export async function validateBody(request, schema) {
  let json;
  try {
    json = await request.json();
  } catch {
    throw new ValidationError("Request body must be valid JSON");
  }

  const result = schema.safeParse(json);
  if (!result.success) {
    const errors = result.error.issues.map((issue) => ({
      field: issue.path.join("."),
      message: issue.message,
    }));
    throw new ValidationError("Validation failed", errors);
  }

  return result.data;
}

/**
 * Validates query params (URLSearchParams) against a Zod schema.
 * Useful for list endpoints (pagination, filters, search).
 */
export function validateQuery(searchParams, schema) {
  const raw = Object.fromEntries(searchParams.entries());
  const result = schema.safeParse(raw);
  if (!result.success) {
    const errors = result.error.issues.map((issue) => ({
      field: issue.path.join("."),
      message: issue.message,
    }));
    throw new ValidationError("Invalid query parameters", errors);
  }
  return result.data;
}
