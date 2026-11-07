import { handleApiError } from "./api-response";

/**
 * Wraps an /api/v1/* route handler so every route gets consistent error
 * handling for free, without repeating try/catch in each file.
 *
 * @example
 * // app/api/v1/products/route.js
 * export const GET = withApiHandler(async (req) => {
 *   const products = await productService.list();
 *   return apiSuccess(products);
 * }, "products/GET");
 */
export function withApiHandler(handler, routeContext) {
  return async function wrapped(...args) {
    try {
      return await handler(...args);
    } catch (error) {
      return handleApiError(error, routeContext);
    }
  };
}
