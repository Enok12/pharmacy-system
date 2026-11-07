/**
 * Error-handling strategy (Phase 1 foundation).
 *
 * Every predictable failure mode (bad input, missing record, no permission,
 * conflicting state) should throw one of these typed errors from the
 * service layer. Route handlers never need to know *why* something failed —
 * they just pass the error to `toApiError()` (see api-response.js) and it
 * maps to the right HTTP status and response shape automatically.
 *
 * Anything that is NOT one of these (a raw exception, a DB driver error,
 * etc.) is treated as unexpected: logged with full detail, returned to the
 * client as a generic 500 message so internals never leak.
 */

export class AppError extends Error {
  constructor(message, statusCode = 500, errors = []) {
    super(message);
    this.name = "AppError";
    this.statusCode = statusCode;
    this.errors = errors;
    this.isOperational = true; // expected, safe to show to the client
  }
}

export class ValidationError extends AppError {
  constructor(message = "Validation failed", errors = []) {
    super(message, 422, errors);
    this.name = "ValidationError";
  }
}

export class NotFoundError extends AppError {
  constructor(resource = "Resource") {
    super(`${resource} not found`, 404);
    this.name = "NotFoundError";
  }
}

export class UnauthorizedError extends AppError {
  constructor(message = "Authentication required") {
    super(message, 401);
    this.name = "UnauthorizedError";
  }
}

export class ForbiddenError extends AppError {
  constructor(message = "You do not have permission to perform this action") {
    super(message, 403);
    this.name = "ForbiddenError";
  }
}

export class ConflictError extends AppError {
  constructor(message = "Request conflicts with current state") {
    super(message, 409);
    this.name = "ConflictError";
  }
}
