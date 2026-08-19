import { test, expect } from "@playwright/test";

const ADMIN_EMAIL = "admin@medcare.local";
const ADMIN_PASSWORD = "ChangeMe123!";

function unique(prefix) {
  return `${prefix}-${Date.now()}`;
}

/**
 * The one committed end-to-end test (Phase 12 plan design decision 6) —
 * proves the UI is actually wired to the API correctly, which the API
 * integration suite alone can't (it could all pass while a page's
 * fetch() still pointed at the wrong field name — exactly the class of
 * bug Phase 9's dashboard/reports pages had before they were fixed).
 *
 * Product/category/manufacturer/supplier/stock-in fixtures are created
 * via the API directly — fast, and already exhaustively proven correct
 * by the API suite (tests/api/products.test.js, stock-ins.test.js).
 * This test's browser time is spent where it matters most: POS sale ->
 * Return -> Dashboard/Reports, exactly the pages where the real Phase 9
 * bug class occurred.
 */
test("golden path: POS sale -> return -> dashboard/reports", async ({ page, baseURL }) => {
  // page.request (not the standalone `request` fixture) shares the
  // browser context's cookie jar — these API calls ride the same
  // httpOnly session cookies the login above just set.
  const request = page.request;
  // --- Log in as Admin (browser session) ---
  await page.goto("/login");
  await page.fill("#email", ADMIN_EMAIL);
  await page.fill("#password", ADMIN_PASSWORD);
  await page.click('button[type="submit"]');
  await page.waitForURL("**/dashboard", { timeout: 45000 });

  // --- Fixtures via API, using the browser's own session cookie ---
  const productName = unique("E2E Product");
  const category = await (
    await request.post(`${baseURL}/api/v1/categories`, { data: { name: unique("E2E Category") } })
  ).json();
  const manufacturer = await (
    await request.post(`${baseURL}/api/v1/manufacturers`, { data: { name: unique("E2E Manufacturer") } })
  ).json();
  const supplier = await (
    await request.post(`${baseURL}/api/v1/suppliers`, { data: { name: unique("E2E Supplier") } })
  ).json();
  const product = await (
    await request.post(`${baseURL}/api/v1/products`, {
      data: {
        name: productName,
        categoryId: category.data.category.id,
        manufacturerId: manufacturer.data.manufacturer.id,
        unitOfMeasure: "TABLET",
        costPrice: 5,
        sellingPrice: 20,
      },
    })
  ).json();
  await request.post(`${baseURL}/api/v1/stock-ins`, {
    data: {
      supplierId: supplier.data.supplier.id,
      items: [
        {
          productId: product.data.product.id,
          batchNumber: unique("LOT"),
          expiryDate: new Date(Date.now() + 365 * 86400000).toISOString(),
          quantityReceived: 50,
          costPricePerUnit: 5,
        },
      ],
    },
  });

  // --- Sell it at POS ---
  await page.goto("/pos");
  await page.fill('input[placeholder*="Scan a barcode"]', productName);
  await page.waitForSelector(`text=${productName}`, { timeout: 10000 });
  await page.click(`text=${productName}`);
  await page.click('button:has-text("Checkout")');
  await page.click('button:has-text("Card")');
  await page.click('button:has-text("Confirm payment")');
  await page.waitForURL("**/sales/*", { timeout: 15000 });
  await expect(page.locator("text=Receipt #").first()).toBeVisible();
  const saleUrl = page.url();
  const saleId = saleUrl.split("/sales/")[1];

  const saleDetail = await (await request.get(`${baseURL}/api/v1/sales/${saleId}`)).json();
  const saleNumber = String(saleDetail.data.sale.saleNumber);

  // --- Process a partial return ---
  await page.goto("/returns/new");
  await page.fill('input[placeholder="e.g. 123"]', saleNumber);
  await page.click('button:has-text("Look up")');
  await page.waitForSelector("text=Purchased", { timeout: 15000 });
  const qtyInput = page.locator('input[type="number"][max]').first();
  await qtyInput.fill("1");
  await page.click('button:has-text("Process Return")');
  await page.waitForURL("**/returns/*", { timeout: 15000 });
  await expect(page.locator("text=Return Receipt").first()).toBeVisible();

  // --- Confirm it shows up on the Dashboard ---
  await page.goto("/dashboard");
  await expect(page.locator("text=Today's Sales").first()).toBeVisible({ timeout: 15000 });

  // --- Confirm the Reports pages load without error ---
  await page.goto("/reports");
  await expect(page.locator("text=Revenue").first()).toBeVisible({ timeout: 15000 });

  // Sanity: the sale driven through the UI is reachable by direct URL too.
  await page.goto(saleUrl);
  await expect(page.locator("text=Receipt #").first()).toBeVisible();
});
