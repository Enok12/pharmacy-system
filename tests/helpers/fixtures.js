import { apiRequest } from "./client.js";

let counter = 0;
function unique(prefix) {
  counter += 1;
  return `${prefix}-${Date.now()}-${counter}`;
}

/**
 * Fixtures go through the real, validated API (not direct DB writes) —
 * see the Phase 12 plan design decision 5. Every name is unique so
 * different test files' fixtures never collide on a unique constraint.
 */

export async function createCategory(token, overrides = {}) {
  const { body } = await apiRequest("POST", "/api/v1/categories", {
    token,
    body: { name: unique("Category"), ...overrides },
  });
  return body.data.category;
}

export async function createManufacturer(token, overrides = {}) {
  const { body } = await apiRequest("POST", "/api/v1/manufacturers", {
    token,
    body: { name: unique("Manufacturer"), ...overrides },
  });
  return body.data.manufacturer;
}

export async function createProduct(token, overrides = {}) {
  const categoryId = overrides.categoryId ?? (await createCategory(token)).id;
  const manufacturerId = overrides.manufacturerId ?? (await createManufacturer(token)).id;

  const { body } = await apiRequest("POST", "/api/v1/products", {
    token,
    body: {
      name: unique("Product"),
      unitOfMeasure: "TABLET",
      costPrice: 5,
      sellingPrice: 10,
      taxRate: 0,
      reorderLevel: 5,
      ...overrides,
      categoryId,
      manufacturerId,
    },
  });
  return body.data.product;
}

export async function createSupplier(token, overrides = {}) {
  const { body } = await apiRequest("POST", "/api/v1/suppliers", {
    token,
    body: { name: unique("Supplier"), ...overrides },
  });
  return body.data.supplier;
}

export async function createStockIn(
  token,
  { productId, quantity = 100, costPricePerUnit = 5, expiryDate, supplierId, batchNumber } = {}
) {
  const resolvedSupplierId = supplierId ?? (await createSupplier(token)).id;

  const { body } = await apiRequest("POST", "/api/v1/stock-ins", {
    token,
    body: {
      supplierId: resolvedSupplierId,
      items: [
        {
          productId,
          batchNumber: batchNumber ?? unique("LOT"),
          expiryDate: expiryDate ?? new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
          quantityReceived: quantity,
          costPricePerUnit,
        },
      ],
    },
  });
  return body.data.stockIn;
}

/**
 * Convenience: a product with one receiving batch already on hand — the
 * common starting point most domain tests (sales, adjustments, returns)
 * actually need.
 */
export async function createProductWithStock(
  token,
  { quantity = 100, sellingPrice = 10, costPricePerUnit = 5, taxRate = 0 } = {}
) {
  const product = await createProduct(token, { sellingPrice, taxRate });
  const stockIn = await createStockIn(token, { productId: product.id, quantity, costPricePerUnit });
  return { product, stockIn, batch: stockIn.batches[0] };
}

/**
 * Checks out the given line items directly — there's no server-side
 * cart to build up first (see the "drop DB-backed cart" plan);
 * `POST /api/v1/sales` takes `items` straight in the body.
 */
export async function checkout(token, { paymentMethod = "CASH", amountTendered, items } = {}) {
  const { body } = await apiRequest("POST", "/api/v1/sales", {
    token,
    body: {
      paymentMethod,
      ...(paymentMethod === "CASH" ? { amountTendered: amountTendered ?? 1_000_000 } : {}),
      items,
    },
  });
  return body.data?.sale;
}
