# MedCare Pharmacy — Inventory & POS System

Production-track pharmacy inventory management and POS system. Built in
phases per the project master specification — see **Phase Status** below
for what's implemented so far.

Single backend API (`/api/v1`) + PostgreSQL is the source of truth for all
business rules, so the planned Flutter app, barcode scanners, and thermal
printers can all integrate later without duplicating logic. See
[`API.md`](./API.md) for the full endpoint reference, including the
mobile (Bearer token) auth flow and the barcode/receipt hardware
contracts.

## Tech stack

- **Frontend:** Next.js (App Router, JavaScript), Tailwind CSS v4
- **Backend:** Next.js Route Handlers, REST, `/api/v1` versioning
- **Database:** PostgreSQL + Prisma ORM
- **Validation:** Zod
- **Icons:** lucide-react
- **Testing:** Vitest (API integration suite) + Playwright (one E2E smoke test)

## Getting started

### 1. Install dependencies

```bash
npm install
```

### 2. Configure environment

```bash
cp .env.example .env
```

Edit `.env` and set `DATABASE_URL` to a real PostgreSQL connection string.
Any Postgres works for local dev — a free [Neon](https://neon.tech) or
[Supabase](https://supabase.com) instance, or a local install:

```bash
# example local Postgres
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/pharmacy_db?schema=public"
```

### 3. Generate the Prisma client and apply migrations

```bash
npx prisma generate
npx prisma migrate dev
npx prisma db seed
```

`db seed` creates the first Admin account from `SEED_ADMIN_EMAIL` /
`SEED_ADMIN_PASSWORD` in `.env` (defaults: `admin@medcare.local` /
`ChangeMe123!`) — there's no signup flow, so this is the only way to get
a first login on a fresh database. Every user after that is created by an
Admin via `POST /api/v1/users`.

### 4. Run the dev server

```bash
npm run dev
```

Visit **http://localhost:3000** — it redirects to `/dashboard`, which
redirects to `/login` if you're not signed in. Sign in with the seed
Admin account above.

On the dashboard, click **"Run health check"** to confirm the API,
Prisma, and your database connection are all wired correctly end-to-end.

### 5. Running the tests

```bash
cp .env.test.example .env.test   # then edit DATABASE_URL to a `?schema=test` variant
npm test          # API integration suite (Vitest) — 93 tests
npm run test:e2e  # one end-to-end browser test (Playwright)
```

Both suites run against a real, isolated Postgres **schema** (`test`, not
`public`) on the same database server as your regular `.env` — never your
dev data. `npm test` resets that schema from scratch on every run (via
`prisma migrate reset`); both suites build and run a real production
(`next build && next start`) server on their own port (3099 / 3098) and
tear it down afterward.

**Stop your regular `npm run dev` server before running either suite.** A
concurrent `next dev` process contending for the same source files during
`next build` was found to corrupt the build — both suites detect this and
fail fast with a clear message rather than silently producing a broken
build (see `tests/setup/global-setup.js` for the full story, including
three other environment-specific bugs this phase's own test runs
surfaced and fixed along the way).

## Project structure

```
app/
  (app)/                 # route group sharing the sidebar/header shell
    dashboard/page.js    # Phase 1 placeholder — real dashboard is Phase 9
    layout.js            # fetches the auth user server-side, gates via proxy.js
    products/             # tabbed Products / Categories / Manufacturers screen
      page.js               # server wrapper — resolves the CASHIER read-only flag
      ProductsPageClient.jsx  # tab strip + active-tab switch
      ProductsTab.jsx / ProductForm.jsx
      CategoriesTab.jsx / CategoryForm.jsx
      ManufacturersTab.jsx / ManufacturerForm.jsx
    suppliers/            # Admin/Pharmacist only (Cashier redirected away)
      page.js, SuppliersClient.jsx, SupplierForm.jsx
    stock-in/             # Admin/Pharmacist only
      page.js, StockInHistoryClient.jsx      # receipt history
      new/page.js, new/StockInForm.jsx        # multi-line-item receiving form
      [id]/page.js, [id]/StockInDetailClient.jsx  # read-only receipt detail
    inventory/            # everyone reads; Adjust action gated to Admin/Pharmacist (Phase 8)
      page.js               # server wrapper — resolves the CASHIER-can't-adjust flag
      InventoryPageClient.jsx # stock-on-hand + expiry summary table
      BatchesModal.jsx        # per-product FEFO-ordered batch view + Adjust action
    pos/                   # everyone — search/scan-driven cart, no server wrapper needed
      page.js                # client-only (sessionStorage) cart + search/scan panel — no cart API
      CheckoutModal.jsx       # payment method + cash tendered/change, sends items to POST /sales
    sales/                 # everyone — visibility is role-scoped, not gated (see below)
      page.js                # history list
      [id]/page.js            # receipt — used both post-checkout and when reprinting
    returns/               # Admin/Pharmacist only (Cashier redirected away)
      page.js, ReturnsHistoryClient.jsx      # processed-returns history
      new/page.js, new/ReturnForm.jsx         # sale-number lookup + line-item return form
      [id]/page.js, [id]/ReturnDetailClient.jsx  # read-only return receipt
    reports/               # Admin/Pharmacist only — tab strip (no sub-routes)
      page.js, ReportsClient.jsx              # tab shell (Sales / Top Products / Valuation)
      SalesReportTab.jsx, TopProductsTab.jsx, ValuationTab.jsx
    audit/                 # Admin/Pharmacist only — separate page, not a Reports tab
      page.js, AuditClient.jsx                # unified StockAdjustment + SaleReturn log
  login/page.js           # sign-in form, outside the (app) shell
  api/v1/                # all backend routes live here, versioned
    health/route.js
    auth/{login,refresh,logout,me}/route.js  # dual-mode: cookies (web) or
                                              # X-Client-Type: mobile + Bearer (10)
    users/route.js       # list/create users (Admin only)
    categories/route.js, categories/[id]/route.js
    manufacturers/route.js, manufacturers/[id]/route.js
    products/route.js, products/[id]/route.js
    suppliers/route.js, suppliers/[id]/route.js
    stock-ins/route.js, stock-ins/[id]/route.js   # POST creates atomically; no PATCH/DELETE
    batches/route.js, batches/[id]/route.js       # read-only
    inventory/route.js                            # stock-on-hand summary, read-only
    inventory/products/[id]/batches/route.js       # FEFO-ordered batches for one product
    inventory/products/[id]/fefo/route.js          # read-only allocation preview
    sales/route.js                                 # POST checkout (atomic, items in the body — no
                                                    # server-side cart); GET history, role-scoped
    sales/[id]/route.js                            # GET one sale; no PATCH/DELETE — immutable
    sales/[id]/returnable/route.js                 # GET a sale's per-line returnable quantities
    stock-adjustments/route.js                     # GET list, POST create — no PATCH/DELETE
    sale-returns/route.js                          # GET list, POST create (atomic, reverse-FEFO restock)
    sale-returns/[id]/route.js                     # GET one return; no PATCH/DELETE — immutable
    dashboard/stats/route.js                       # role-aware stat cards, any role
    dashboard/alerts/route.js                      # low-stock + expiring-soon feed, any role
    dashboard/sales-trend/route.js                 # daily revenue buckets, Admin/Pharmacist
    reports/sales/route.js                         # revenue/tax/cost/profit over a date range
    reports/inventory-valuation/route.js           # point-in-time cost/retail value on hand
    reports/top-products/route.js                  # top N by revenue over a date range
    audit-log/route.js                             # unified StockAdjustment + SaleReturn feed
  layout.js              # root layout, wraps app in <ToastProvider>
  globals.css            # design tokens (brand palette, semantic colors)

components/
  layout/                # Sidebar (role-filtered nav), Header (real user + logout),
                          # Breadcrumbs, PageLayout (print:hidden header chrome), AppShell
  ui/                    # Button, Card, Badge — low-level primitives
  feedback/              # LoadingState, ErrorState, EmptyState,
                          # ToastProvider, Modal, ConfirmDialog

lib/
  prisma.js              # Prisma client singleton (driver adapter, see below)
  jwt.js                  # sign/verify access + refresh JWTs (jose)
  auth.js                  # cookie helpers, getAuthUser(), requireAuth(), requireRole()
  auth-cookies.js           # cookie name constants (no next/headers — safe for proxy.js)
  logger.js               # structured logging (createLogger(moduleName))
  errors.js               # typed errors (ValidationError, NotFoundError, ...)
  api-response.js         # apiSuccess / apiError / handleApiError
  api-handler.js           # withApiHandler() route wrapper
  validate.js              # validateBody / validateQuery (Zod-based)
  utils.js                 # formatCurrency / formatDate — shared display formatters (9)
  env.js                   # validateEnv() — fails fast on missing/weak secrets (11)
  rate-limit.js             # in-memory per-IP login rate limiting (11)

instrumentation.js        # runs once at server boot, before requests are served —
                           # calls validateEnv() (11)
proxy.js                  # gates every route except /login and /api/v1/{auth,health}

services/                # business logic layer — auth, user, category, manufacturer,
                          # product, supplier, stockIn, batch, inventory, sale,
                          # stockAdjustment, saleReturn, dashboard, report, audit
validations/             # Zod schemas — same set as services/
prisma/
  schema.prisma          # User/Role/RefreshToken (2), Category/Manufacturer/Product (3),
                          # Supplier/StockIn/Batch (4),
                          # Sale/SaleItem/SaleItemBatch (7), StockAdjustment/SaleReturn/
                          # SaleReturnItem/SaleReturnItemBatch (8) — Phase 5 and 9 added
                          # no models, pure read/aggregation over existing data. Cart/
                          # CartItem (added in 6) were later dropped — see the
                          # "client-only cart" design decisions.
  seed.mjs                # creates the first Admin user (npx prisma db seed)

tests/                  # Phase 12
  setup/global-setup.js   # Vitest globalSetup — resets the test schema, builds +
                          # starts a real `next start` server, obtains role tokens
  helpers/                 # client.js (fetch wrapper), tokens.js, fixtures.js
                          # (API-driven category/product/stock-in/... creation)
  api/                    # one *.test.js per domain — auth, rate-limit, users,
                          # categories, manufacturers, products, suppliers,
                          # stock-ins, inventory, sales, stock-adjustments,
                          # sale-returns, dashboard, reports, audit-log
  e2e/                    # golden-path.spec.js (Playwright) + its own global-setup.mjs
vitest.config.mjs        # API suite config — see tests/setup/global-setup.js
playwright.config.mjs    # E2E config — separate port/distDir from the API suite's
                          # test server, same test-schema database

API.md                   # full API reference for external clients (Flutter, hardware) (10)
```

### Layering convention (all future phases follow this)

```
Route handler (app/api/v1/**/route.js)
  -> requireAuth() / requireRole() (lib/auth.js), if the route needs one
  -> validate input (validations/*.schema.js via lib/validate.js)
  -> call a service (services/*.service.js)
  -> service applies business rules, talks to Prisma, throws typed errors
  -> route returns apiSuccess(data) or lets withApiHandler catch errors
```

Route handlers never talk to Prisma directly, and never contain business
rules — that's what keeps the backend the single source of truth once the
Flutter app exists and hits the same API.

`proxy.js` gates page/API access before any of this runs (redirects
unauthenticated page requests to `/login`, 401s unauthenticated API
requests) — `requireAuth()`/`requireRole()` inside a route handler are
still needed for anything role-restricted (proxy only checks that
the JWT is valid, not the role or current `isActive` state).

### API response format

Every `/api/v1` route returns one of these two shapes:

```json
// success
{ "success": true, "message": "", "data": {} }

// error
{ "success": false, "message": "", "errors": [] }
```

## Phase status

- [x] **Phase 1 — Project Foundation & Architecture** (this scaffold)
- [x] **Phase 2 — Authentication, Users & Permissions**
- [x] **Phase 3 — Product, Category & Manufacturer Management**
- [x] **Phase 4 — Suppliers, Batches & Stock-In**
- [x] **Phase 5 — Inventory Management & Expiry (FEFO)**
- [x] **Phase 6 — POS & Barcode Scanner Ready**
- [x] **Phase 7 — Sales, Payments & Thermal Receipt Architecture**
- [x] **Phase 8 — Sales Returns & Stock Adjustments**
- [x] **Phase 9 — Dashboard, Reports & Audit**
- [x] **Phase 10 — Flutter & Hardware Integration Readiness**
- [x] **Phase 11 — Security, Performance & Production Hardening**
- [x] **Phase 12 — Full System Testing & Final Validation**

## Phase 1 testing checklist

- [x] `npm run dev` starts without errors
- [x] `/dashboard` renders the app shell (sidebar, header, breadcrumbs)
- [x] Database connection works (`npx prisma migrate dev`, then click
      "Run health check" on the dashboard)
- [x] Prisma client generates and connects (via the `@prisma/adapter-pg`
      driver adapter — required as of Prisma 7)
- [x] `/api/v1/health` responds in the standard success/error envelope
- [x] UI shell works — nav highlighting, mobile sidebar toggle, search bar
- [x] Loading / error / empty states render (see dashboard demo section)
- [x] Toasts fire and auto-dismiss
- [x] Modal and confirm dialog open/close, close on Escape and backdrop click
- [x] Environment variables load (`.env` -> `DATABASE_URL`, `APP_NAME`, etc.)

## Phase 2 testing checklist

- [x] `npx prisma migrate dev` applies the `User`/`Role`/`RefreshToken`
      migration cleanly
- [x] `npx prisma db seed` creates the first Admin account
- [x] Visiting any `(app)` route while signed out redirects to
      `/login?next=<path>` (proxy.js)
- [x] Logging in with the wrong password returns a generic "Invalid email
      or password" (never reveals whether the email exists)
- [x] Logging in with correct credentials sets httpOnly `access_token` /
      `refresh_token` cookies and redirects to `/dashboard`
- [x] The header shows the real signed-in user's name/role (not the old
      hardcoded "Admin / Super Admin")
- [x] `POST /api/v1/auth/refresh` rotates the refresh token; the old one
      is rejected if reused
- [x] `POST /api/v1/auth/logout` revokes the refresh token server-side
- [x] `GET /api/v1/users` returns 401 signed-out, 403 for a non-Admin role,
      200 with the user list for an Admin
- [x] `POST /api/v1/users` (Admin) creates a user with a chosen role;
      that user can then log in

## Phase 3 testing checklist

- [x] `npx prisma migrate dev` applies the `Category`/`Manufacturer`/
      `Product`/`UnitOfMeasure` migration cleanly (purely additive, no
      drift/reset needed); price/tax columns are Postgres `numeric`, not
      `double precision`
- [x] For categories, manufacturers, and products: `GET` signed-out → 401,
      `GET` as Cashier → 200 (read-only), `POST`/`PATCH` as Cashier → 403,
      as Pharmacist/Admin → 200/201
- [x] `POST` with a missing/invalid field → 422 with field-level `errors[]`
- [x] `POST` duplicate category/manufacturer name (case-insensitive) or
      duplicate product `(name, manufacturer)`/barcode → 409
- [x] `POST` a product with a `categoryId`/`manufacturerId` that doesn't
      exist → 422, naming the offending field
- [x] `PATCH [id] {isActive:false}` removes an item from the default
      `?isActive=true` list without deleting it; reactivating brings it back
- [x] `/products` renders a Products / Categories / Manufacturers tab strip
      (no separate Sidebar nav entries); the header's "Add" button label
      switches with the active tab
- [x] Creating a category/manufacturer from the Product form's "+" quick-add
      selects it in the dropdown immediately, no tab switch needed
- [x] Editing a product's price and deactivating it (via `ConfirmDialog`)
      both reflect immediately in the table
- [x] Signed in as Cashier, `/products` hides Add/Edit/Deactivate entirely
      (not just a disabled 403 after the fact)

## Phase 4 testing checklist

- [x] `npx prisma migrate dev` applies the `Supplier`/`StockIn`/`Batch`
      migration cleanly (purely additive)
- [x] `GET` on suppliers/stock-ins/batches signed-out → 401; **as Cashier
      → 403** (not 200 — unlike Products, Cashier has no access at all here)
- [x] `POST`/`PATCH` as Cashier → 403; as Pharmacist/Admin → 200/201
- [x] `POST /api/v1/stock-ins` with multiple line items creates the
      `StockIn` and every `Batch` atomically in one nested Prisma write;
      each batch's `quantityRemaining` starts equal to `quantityReceived`
- [x] `POST` a stock-in with a nonexistent `supplierId` or a line item's
      `productId` → 422, naming the offending field (`items[1].productId`
      for multi-item errors)
- [x] `POST` with `items: []` → 422 ("Add at least one product")
- [x] `PATCH`/`DELETE` on `/api/v1/stock-ins/:id` → 405 (confirms
      stock-ins are immutable once recorded — corrections are a Phase 8
      stock adjustment, not an edit)
- [x] Sidebar hides Suppliers/Stock In/Users for Cashier; navigating to
      `/suppliers` or `/stock-in` directly redirects Cashier to `/dashboard`
- [x] `/stock-in/new`'s multi-line-item form records a delivery with 2+
      products, redirects to the receipt detail page showing correct
      per-line and grand totals, and the record then appears in `/stock-in`
      history with the right item count

## Phase 5 testing checklist

- [x] `GET /api/v1/inventory` signed-out → 401; **as Cashier → 200** (the
      one resource so far that's fully open to Cashier for reads, same
      reasoning as Products)
- [x] Per-product `totalRemaining` correctly sums `quantityRemaining`
      across all of that product's batches
- [x] `?stockStatus=LOW`/`OUT` filters the summary correctly
- [x] `GET .../products/:id/batches` returns batches ordered by
      `expiryDate asc` (FEFO order), each with the correct computed
      `EXPIRED`/`EXPIRING_SOON`/`OK` status
- [x] `GET .../products/:id/fefo?quantity=N` allocates from the
      soonest-expiring batch first, splitting across batches as needed;
      requesting more than `totalRemaining` returns `sufficient: false`
      with a partial allocation instead of erroring
- [x] `quantity=0`/missing → 422; nonexistent product id → 404 (both
      `batches` and `fefo` routes)
- [x] Signed in as Cashier (least-privileged role), `/inventory` loads,
      shows correct stock/expiry badges, and "View Batches" opens the
      FEFO-ordered modal with supplier names

## Phase 6 testing checklist

- [x] `npx prisma migrate dev` applies the `Cart`/`CartItem` migration
      cleanly (purely additive)
- [x] `GET /api/v1/cart` signed-out → 401; as any role → 200, auto-creating
      an empty cart on first call
- [x] `POST /api/v1/cart/items` with the same `productId` twice increments
      the existing line instead of creating a duplicate row
- [x] Adding/updating a quantity above **sellable** stock → 422 ("Only N
      in stock") — verified specifically against a product with an
      *expired* batch: Inventory's `totalRemaining` (Phase 5) counts it,
      but POS correctly refuses to sell it, capping at the non-expired
      quantity only
- [x] `PATCH .../items/:id {quantity: 0}` removes the line
- [x] `PATCH`/`DELETE` on an item id belonging to a different user's
      cart → 404, not 403 (doesn't confirm the id exists elsewhere)
- [x] `DELETE /api/v1/cart` empties all items
- [x] Signed in as Cashier, `/pos`'s search box is focused on load; typing
      shows live results; clicking a result or scanning its exact barcode
      (Enter) adds/increments it in the cart with correct live pricing
- [x] The quantity stepper's `+`/`-` buttons update the cart correctly
      (verified via network-synced browser automation after intermittent
      Neon cold-start latency caused a couple of unsynced test runs to
      race ahead of their own network requests — not an app bug)
- [x] "Clear cart" goes through a `ConfirmDialog`; "Checkout" was visibly
      disabled with "Coming in Phase 7" at the time — now enabled, see the
      Phase 7 checklist below
- [x] Cart survives a full page reload (persisted via `Cart`/`CartItem`,
      not client-only state)

## Phase 7 testing checklist

- [x] `npx prisma migrate dev` applies the `PaymentMethod`/`Sale`/
      `SaleItem`/`SaleItemBatch` migration cleanly (purely additive);
      confirms `saleNumber`'s `autoincrement()` on a non-`@id` field works
- [x] Checkout with `CASH` and sufficient `amountTendered` → 201; each
      purchased batch's `quantityRemaining` decreases by exactly the FEFO
      allocation (verified against a two-batch product: the earlier-
      expiring batch was fully depleted before the later one was touched),
      `changeDue` is correct, and the cart is emptied
- [x] Checkout with `CARD` → 201, `amountTendered`/`changeDue` both `null`
- [x] `CASH` with `amountTendered` below total → 422; missing entirely for
      `CASH` → 422; checkout with an empty cart → "Cart is empty" (422)
- [x] **Atomicity**: forced a real stock shortfall (bought most of a
      product's sellable stock from a second account after the first
      account's cart was already approved at add-time, then attempted
      checkout) → 422 naming the exact product and quantity short, **and
      confirmed nothing was written** — sale count unchanged, both the
      short product's batches (including the untouched expired one)
      exactly as before. This is the core guarantee the whole phase rests
      on and it held.
- [x] `GET /api/v1/sales` as Cashier → only that cashier's own sales; as
      Admin → all sales, including other cashiers'
- [x] `GET /api/v1/sales/:id` for another cashier's sale → 404 (not 403 —
      doesn't confirm the id exists); `PATCH`/`DELETE` → 405 (immutable)
- [x] Browser: add to cart, Checkout → modal shows live change calculation
      for Cash, Confirm redirects to `/sales/:id` with correct line items
      and totals; `/sales` history lists it; reopening it from history
      lands on the exact same receipt
- [x] Print preview (`page.emulateMedia({media:'print'})`) shows **only**
      the receipt card — no sidebar/header (global rule) and no
      breadcrumbs/title/action buttons (required adding `print:hidden` to
      `PageLayout`'s header chrome, since those aren't hidden by the
      sidebar/header-only rule alone)

## Phase 8 testing checklist

- [x] `npx prisma migrate dev` applies the `AdjustmentReason`/
      `StockAdjustment`/`SaleReturn`/`SaleReturnItem`/`SaleReturnItemBatch`
      migration cleanly (purely additive)
- [x] Stock Adjustment: a negative `quantityChange` beyond a batch's
      current `quantityRemaining` → 422 ("Adjustment would result in
      negative stock"); a valid negative (damage write-off) → 201, the
      batch's `quantityRemaining` decreases by exactly that amount; a
      valid positive (count correction) → 201, increases by exactly that
      amount (verified `15 → 10 → 20` end-to-end via curl)
- [x] Stock Adjustment as Cashier → 403 on both `GET` and `POST`; signed
      out → 401
- [x] `GET /api/v1/sales/:id/returnable` shows correct `returnedQuantity`/
      `returnableQuantity` per line, recomputed from prior returns (not a
      cached counter)
- [x] Sale Return: requesting more than a line's `returnableQuantity` →
      422 naming the product and the actual returnable amount
- [x] Sale Return with `restock:true` → 201; refund matches
      `quantity × unitPrice × (1 + taxRate/100)` from the sale item's
      snapshot exactly; the exact original batch(es) that line's FEFO
      allocation drew from (`SaleItemBatch`, Phase 7) are credited back
- [x] **Reverse-FEFO restock walks batches most-recent-expiry-first and
      caps each at its original contribution.** Verified against a
      120-unit line split `LOT-A1: 100` / `LOT-X1: 20` at sale time: a
      first partial return of 10 restocked all 10 to `LOT-X1` (still under
      its 20-unit cap); a *second* partial return of 15 correctly split
      `10` to `LOT-X1` (exhausting its remaining headroom exactly, not
      exceeding it) and `5` to `LOT-A1` — proving a second partial return
      of the same line neither over-restocks a batch nor loses units
- [x] A return with `restock:false` → 201, refund recorded, but confirmed
      via `GET .../batches` that no batch's `quantityRemaining` changed
- [x] `PATCH`/`DELETE` on `/api/v1/sale-returns/:id` → 405 (immutable)
- [x] As Cashier, Stock Adjustment and Sale Return routes (including
      `GET .../returnable`) → 403 across the board, not 401 — same
      "authenticated but not permitted" precedent as Suppliers/Stock-In
- [x] Sidebar hides `Returns` for Cashier and shows it for Admin;
      navigating to `/returns`, `/returns/new`, or `/returns/:id` directly
      as Cashier redirects to `/dashboard`
- [x] Browser: `/inventory` → Batches modal → Adjust a batch → toast
      confirms and the batch list reflects the new quantity without a
      full page reload
- [x] Browser: `/returns/new` → look up a sale by number → per-line
      Purchased/Already returned/Returnable columns match the API;
      entering a return quantity live-updates the per-line and total
      refund before submitting → redirects to the return's receipt page
- [x] Browser: `/returns` history lists the processed return with the
      correct refund amount and payment-method badge

## Phase 9 testing checklist

- [x] No migration needed — pure read/aggregation over existing data
- [x] `GET /api/v1/dashboard/stats` signed-out → 401; as Cashier → 200 with
      `mySalesToday` only (no store-wide fields); as Admin → 200 with
      `todaysSales`/`monthRevenue`/`inventoryValue` — cross-checked
      `inventoryValue` against `GET /api/v1/reports/inventory-valuation`'s
      independently-computed `totals.costValue`: exact match (574.80)
- [x] `GET /api/v1/dashboard/alerts` as Cashier → 200 (open, matches
      Inventory's own openness)
- [x] `GET /api/v1/dashboard/sales-trend` as Cashier → 403; as Admin → 200
- [x] **Found and fixed a real timezone bug during verification**: the
      trend's zero-filled buckets were built from local-time date
      arithmetic while `dateKey()` reads dates back out via `toISOString()`
      (UTC) — on this server (UTC+5:30) every bucket key was off by one
      day, so today's sales silently fell into no bucket and vanished from
      the chart. Fixed by computing bucket boundaries in UTC throughout;
      re-verified today's bucket then correctly showed the day's revenue
- [x] `GET /api/v1/reports/sales` as Cashier → 403; as Admin → 200;
      `totals.revenue`/`saleCount` matched a hand-summed total across the
      period's known test sales exactly
- [x] `GET /api/v1/reports/inventory-valuation` totals cross-checked
      against `dashboard/stats` (see above) — exact match
- [x] `GET /api/v1/reports/top-products` — quantities/revenue per product
      matched hand-summed totals across known test sales exactly
- [x] `GET /api/v1/audit-log` returns `StockAdjustment` and `SaleReturn`
      records merged and sorted by `createdAt desc` (7 total: 3
      adjustments + 4 returns from Phase 8's test data); as Cashier → 403
- [x] Sidebar hides `Reports` and `Audit` for Cashier; navigating to
      `/reports` or `/audit` directly as Cashier redirects to `/dashboard`
- [x] Browser: Cashier dashboard shows "My Sales Today" plus alert cards,
      no revenue/chart; Admin dashboard shows the full stat-card set plus
      a rendering 14-day sales trend chart
- [x] Browser: `/reports`' three tabs (Sales, Top Products, Inventory
      Valuation) each load without error; `/audit` (separate page, not a
      Reports tab) shows the merged, correctly-badged log

## Phase 10 testing checklist

- [x] No migration — auth transport only, `RefreshToken` unchanged
- [x] `POST /api/v1/auth/login` with `X-Client-Type: mobile` → `200`,
      `accessToken`/`refreshToken` in the body, **zero** `Set-Cookie`
      headers on the response
- [x] `POST /api/v1/auth/login` with no header (web) → `200`, body has
      only `{ user }`, both cookies set — confirmed byte-for-byte
      unchanged from Phase 2, no regression
- [x] The mobile access token as `Authorization: Bearer <token>` works
      identically to cookie auth across every role gate tried:
      `GET /api/v1/auth/me` (any role), `GET /api/v1/products` (any
      role), `GET /api/v1/reports/sales` as Admin → `200`, the same
      route with a Cashier's Bearer token → `403` — no route needed any
      change to support this
- [x] No `Authorization` header and no cookie → `401`; a malformed
      `Authorization` header (not `Bearer <token>` shape) → `401`, not `500`
- [x] Mobile refresh (header + body `refreshToken`) → new pair returned,
      no cookies set; replaying the now-rotated old refresh token → `401`
      (existing rotation/reuse-detection logic, unmodified, applies
      identically to a body-sourced token)
- [x] Mobile logout (header + body `refreshToken`) → revokes; a
      subsequent refresh attempt with that token → `401`

## Phase 11 testing checklist

- [x] `npm audit` (full, and `--omit=dev`) → **0 vulnerabilities**
- [x] Prisma schema indexing audited (`@@index`/`@unique` across every
      model) → already thorough from Phases 2-9, nothing missing
- [x] `npm run build` succeeds cleanly before and after this phase's
      changes
- [x] Unsetting `ACCESS_TOKEN_SECRET` and starting the server →
      `instrumentation.js` throws a clear "Missing required environment
      variable(s)" error and the server refuses to come up, instead of
      silently signing tokens with the literal string `"undefined"` as
      the key; restoring the value → starts normally
- [x] 11 rapid `POST /api/v1/auth/login` attempts from one client → the
      11th returns `429` with a `Retry-After` header; a *correct*-password
      attempt while still over the cap is **also** blocked (confirms every
      attempt counts, not just failures); the same cap blocks mobile-mode
      login (`X-Client-Type: mobile`) too — same route, same check, before
      the web/mobile branch
- [x] Confirmed the limiter's window expiry resets the count (simulated
      via a controlled `Date.now()` offset in a standalone script rather
      than an actual 15-minute wait)
- [x] `curl -i` any route → `X-Frame-Options`, `X-Content-Type-Options`,
      `Referrer-Policy`, `Permissions-Policy` all present;
      `Strict-Transport-Security` present under `next start` (production)
      and confirmed **absent** under `next dev`
- [x] An existing user hashed at the old bcrypt cost (10) still logs in
      correctly; a newly-created user (hashed at the new cost, 12) logs in
      correctly too — bcrypt's self-describing per-hash cost factor means
      both coexist with no migration

## Phase 12 testing checklist

- [x] `npm test` — **93/93 tests passing** across 16 files, covering every
      domain: happy path, validation (`422`), the exact RBAC matrix per
      resource, `404`/`409` where applicable, `405` on every immutable
      resource, and each domain's specific business rules (FEFO ordering
      and partial-allocation behavior, checkout atomicity under a real
      forced stock race, reverse-FEFO restock math across two batches
      with no over-restock on a second partial return, the login rate
      limiter, dual-mode auth, dashboard/report totals cross-checked
      against known fixtures)
- [x] `npm run test:e2e` — the golden-path journey (POS sale → return →
      dashboard → reports, driven through the real browser UI) passes
- [x] Confirmed the test schema is genuinely isolated: after
      `prisma migrate reset` against it, the dev database's `public`
      schema (checked via the regular dev server) still shows all data
      accumulated across Phases 1-11 untouched
- [x] `npm run lint` and `npm run build` both still pass cleanly after
      every change this phase made
- [x] **This phase's own test runs surfaced and fixed four real,
      previously-invisible environment bugs** — see the design decisions
      below. None were caught by 11 phases of manual curl/browser
      verification, because none of that manual testing ever ran a real
      production build; building the test suite is what finally exercised
      that path
- [x] Two genuine test-writing mistakes were also caught and fixed during
      this phase (not app bugs): a batch's expiry date fixture that
      landed inside the app's own 30-day "expiring soon" window while the
      test asserted `"OK"`, and a FEFO-preview test reading
      `body.data.sufficient` instead of the route's actual
      `body.data.allocation.sufficient` shape

## Notes on design decisions

- **No `next/font/google`:** POS terminals often run on unreliable pharmacy
  floor networks, so the app uses a system font stack instead of fetching
  fonts at build time. Swap in a self-hosted font later if a brand
  typeface is required.
- **Auth is JWT access + refresh tokens, carried in httpOnly cookies** —
  not `Authorization` headers. Cookies are what let `proxy.js` gate
  routes server-side before any page renders; a token held only in
  client-side JS wouldn't be visible there. Access tokens are short-lived
  (15m) and stateless (never revoked individually); refresh tokens are
  stored hashed in `RefreshToken` and rotated on every use, so logout and
  reuse-detection are both possible.
- **No public signup.** Accounts are Admin-provisioned via
  `POST /api/v1/users`, matching how pharmacy staff logins actually get
  set up (owner/manager creates the account, not self-serve). The seed
  script (`prisma/seed.mjs`) exists only to bootstrap the first Admin.
- **`prisma/seed.mjs` uses a `.mjs` extension** (not `.js`) because it's
  run directly by `node`, and the project has no `"type": "module"` in
  `package.json` — everything else uses `import`/`export` syntax but goes
  through Next.js's own bundler, which doesn't care about that field.
- **`/products` is one route with an in-page tab strip**, not three
  separate pages/nav entries. `Sidebar.jsx`'s `NAV_ITEMS` has exactly one
  entry for this domain and adding nav items was out of scope for this
  phase — Categories and Manufacturers are managed from tabs on the same
  page instead, plus a "+" quick-add inline in the Product form's
  category/manufacturer dropdowns.
- **Money fields (`costPrice`, `sellingPrice`, `taxRate`) are Prisma
  `Decimal`**, not `Float` — standard "never use binary float for money"
  rule. Services convert them to `Number(...)` before a response leaves
  the service layer; Prisma returns a `Decimal.js` object, not a plain
  number.
- **Products/Categories/Manufacturers are soft-deactivated (`isActive`),
  never hard-deleted**, and deactivate/reactivate both go through the
  normal `PATCH [id]` endpoint (`isActive` is just another field) — no
  separate `DELETE`/`/deactivate` route exists. Later phases (Batches,
  Sales) will FK to `Product`, so hard delete would be unsafe.
- **Stock-in is a receipt header (`StockIn`) + line items (`Batch`),
  created atomically and never edited afterward.** A real supplier
  delivery has multiple products at once, so recording it as one
  `StockIn` with N `Batch` rows (one nested `prisma.stockIn.create()`
  call, no explicit `$transaction` needed) gives an audit trail per
  delivery. There's deliberately no `PATCH`/`DELETE` on stock-ins —
  correcting a received quantity is a *stock adjustment*, which is
  explicitly Phase 8's job, not this one's.
- **`Batch.quantityRemaining` is stored separately from
  `quantityReceived`, seeded equal at creation.** Nothing decrements it
  yet — that starts in Phase 7 (Sales) — but adding the field now avoids
  a later migration, the same way `Product.reorderLevel` was added in
  Phase 3 well before Phase 9's low-stock alerting exists.
- **Suppliers/Batches/Stock-In give Cashier no access at all** (not even
  `GET`), unlike Products where Cashier gets read-only access for future
  POS lookups. This is enforced twice: every route requires
  `requireRole(["ADMIN","PHARMACIST"])` (not just `requireAuth()`), and
  `Sidebar.jsx` now filters `NAV_ITEMS` by an optional `roles` array so
  Cashier never even sees the `Suppliers`/`Stock In` links (`Users` was
  also given `roles: ["ADMIN"]` here, closing a Phase 2 gap where any
  signed-in role could see that link and just get a 403). Each page
  under `/suppliers` and `/stock-in` also redirects Cashier to
  `/dashboard` server-side as defense-in-depth, same pattern as
  `(app)/layout.js`'s auth check.
- **Phase 5 adds no Prisma models.** Stock-on-hand (`sum(Batch.quantityRemaining)`
  per product) and expiry status are computed on every request from
  Phase 4's data, not cached in a column — there's only one source of
  truth for a number this cheap to derive.
- **The FEFO allocation endpoint (`GET .../products/:id/fefo`) is a
  read-only preview that mutates nothing** — it exists before any real
  consumer does (Sales don't exist until Phase 7), the same way Phase 4
  exposed `GET /api/v1/batches` as groundwork before this phase used it.
  It skips expired batches and batches with no remaining quantity, and
  returns `sufficient: false` with a partial allocation rather than
  erroring when requested quantity exceeds what's on hand — letting the
  eventual Sale-creation flow decide how to handle that, rather than this
  phase guessing at a policy it doesn't own.
- **The 30-day "expiring soon" window is a hardcoded constant**
  (`EXPIRING_SOON_DAYS` in `services/inventory.service.js`), not a
  configurable setting — there's no `Settings` model yet, and adding one
  just for this single threshold would be scope creep for a phase that
  otherwise adds zero new persisted state.
- **The cart persists to the database (`Cart`/`CartItem`, one cart per
  user), not client-only React state** — a refresh or accidental
  navigation away mid-sale shouldn't lose it. `CartItem` deliberately
  carries no price/tax snapshot: unlike `Batch.costPricePerUnit` (which
  locks in a real transaction's cost), a cart isn't committed yet, so it
  should always reflect the product's *current* price. Snapshotting
  happens at Phase 7's checkout, when a `Sale`/`SaleItem` is actually
  created.
  **Superseded later**: writing to Postgres on every cart click made the
  POS feel slow, so `Cart`/`CartItem` were dropped entirely — see the
  "client-only cart" design decisions near the end of this section for
  the replacement.
- **POS stock validation checks `inventoryService.getSellableStock()`
  (non-expired batches only), not the `totalRemaining` Phase 5's
  Inventory page shows** (which deliberately includes expired stock so
  staff can see it exists). The two numbers are allowed to disagree —
  Inventory answers "what's physically here," POS answers "what can I
  sell right now." It's also a soft guard, not a true reservation system:
  it checks total sellable stock at the moment of add/update, not stock
  minus every other open cart. The real atomic, race-condition-safe
  enforcement point is Phase 7's checkout, which every cart is racing
  toward anyway.
  **Superseded later**: this add-time soft guard was removed along with
  the server-side cart — checkout's atomic check (unchanged) is now the
  *only* stock check.
- **Barcode scanning reuses the existing product search endpoint
  (`GET /api/v1/products?search=`, Phase 3) instead of a dedicated
  lookup route.** One always-focused input drives both live-search-by-name
  and scanner input; pressing Enter checks the current result set for an
  exact `barcode` match and adds it, or does nothing if there isn't one —
  never adds the wrong product from a fuzzy match.
- **"Checkout" was a visibly disabled button with "Coming in Phase 7"
  text through Phase 6**, rather than a working-looking dead end, since
  there was no `Sale` model yet to create. Phase 7 is what turns it on —
  see below.
- **Checkout is the app's first genuine multi-step `prisma.$transaction`.**
  Every earlier phase's "atomic" write was a single nested `.create()`
  call (e.g. Phase 4's `StockIn`+`Batch`), atomic for free. Checkout has
  to re-validate stock, create the `Sale`, create N `SaleItem`s and their
  `SaleItemBatch` FEFO allocations, and decrement every allocated
  `Batch.quantityRemaining` — all or nothing. Verified directly: a forced
  stock shortfall wrote zero rows, not a partial sale. (At the time this
  also cleared the server-side cart in the same transaction; that step is
  gone now that the cart is client-only — see below.)
- **Checkout re-validates stock inside the transaction — this is the real
  enforcement point Phase 6 explicitly deferred to it.** Phase 6's cart
  add/update check was documented as "a soft guard... not a true
  reservation system"; `inventoryService.getFefoAllocation` gained an
  optional `client` parameter (defaulting to the module's `prisma`) so
  checkout can call it with the transaction's `tx` and get a consistent
  view instead of duplicating the allocation logic.
- **`SaleItem` snapshots `productName`/`unitPrice`/`taxRate`/line amounts
  at sale time; `CartItem` deliberately never did.** A cart isn't
  committed, so it always shows live pricing (Phase 6). A `Sale` is a
  permanent financial record and must stay reproducible even if the
  product's price changes tomorrow — same reasoning as `Batch`
  snapshotting a stock-in's real cost.
- **`SaleItemBatch` is a new junction table** recording exactly which
  batch(es) a sale line's FEFO allocation drew from and how much — Phase
  8 ("Sales Returns & Stock Adjustments") needs this to know what to
  restock when an item is returned, the same way Phase 4's
  `Batch.quantityRemaining` was groundwork for this phase's deduction.
- **`Sale` is immutable — no `PATCH`/`DELETE`.** Same reasoning as
  Phase 4's `StockIn`: correcting or reversing a sale is a *return*,
  which is Phase 8's job, not an edit to the original record.
- **Sales history visibility is role-scoped, not role-gated.** A Cashier
  can check out (tied to their own cart, same as POS) and view their
  *own* sales, but not other cashiers'; Admin/Pharmacist see everyone's.
  This is a `services/sale.service.js` filter on `cashierId`, not a page
  redirect — `/sales` stays unrestricted in `Sidebar.jsx`, same as
  `/inventory` and `/pos`.
- **The receipt page (`/sales/:id`) is the single view used both right
  after checkout and when reprinting from history** — no separate
  confirmation screen to keep in sync.
- **Print styling is one small global rule plus one shared-component
  tweak, not a per-page hack.** `app/globals.css` hides `<aside>`/
  `<header>` (the Sidebar/Header chrome — nobody printing anything from
  this app wants it) via `@media print`; `PageLayout`'s breadcrumbs and
  title/actions row got Tailwind's `print:hidden` so a printed receipt
  shows only the receipt card, not the page's own header furniture. Both
  changes apply to any future printable page, not just this one.
- **Restocking a return reverses the exact original FEFO allocation,
  batch by batch, via a new junction table `SaleReturnItemBatch`
  (mirroring Phase 7's `SaleItemBatch`).** It walks that line's original
  allocations in reverse — most-recently-allocated (latest-expiry) batch
  first, minimizing disruption to the FEFO order future sales will see —
  capping each batch's add-back at *(that batch's original contribution −
  what prior returns of this same line already restocked to it)*. This is
  what lets a line be partially returned more than once without ever
  over-restocking a batch beyond what it actually gave up.
- **Refund amounts are always server-computed from the sale item's
  stored `unitPrice`/`taxRate` snapshot, never client-supplied.** A line's
  refund is `quantity × unitPrice × (1 + taxRate/100)`; the return's total
  is the sum. Same reproducibility guarantee as `SaleItem`'s own snapshot
  — a return request can't claim an arbitrary refund.
- **Over-returning is prevented by summing prior `SaleReturnItem.quantity`
  per `saleItemId` across *all* returns on demand, not a denormalized
  counter on `SaleItem`.** Same "single source of truth, computed not
  cached" reasoning as Phase 5's inventory aggregation — a line can be
  partially returned more than once, and each attempt re-validates
  against the true remaining-returnable quantity inside the same
  transaction that writes the new return.
- **`StockAdjustment` and `SaleReturn` are immutable audit entries — no
  `PATCH`/`DELETE`**, same ledger discipline as `StockIn`/`Sale`. A
  mistaken adjustment or return gets corrected by posting another one in
  the opposite direction, never by editing history.
- **Sales Returns and Stock Adjustments are Admin/Pharmacist only —
  Cashier has no access, not even read**, extending Phase 4's Suppliers/
  Stock-In precedent: a Cashier can *sell* but not *reverse a sale* or
  *manually correct stock*. `Sidebar.jsx`'s existing `/returns` entry
  (previously unrestricted — a leftover placeholder from Phase 1) gained
  `roles: ["ADMIN","PHARMACIST"]`. Stock Adjustments live inside Phase 5's
  Inventory page rather than a new page, gated by a `canAdjust` server
  flag (`InventoryPageClient`/`BatchesModal`) — the same `canWrite`
  pattern Phase 3 used for Products, reintroduced here since Phase 5
  originally had no write action to gate.
- **No adjustment-history page this phase.** `GET /api/v1/stock-adjustments`
  exists so the data is queryable, but a full audit/history view belongs
  to Phase 9 ("Dashboard, Reports & Audit") by name.
- **`SaleReturn.reason` is a plain optional text field, not an enum**,
  unlike `StockAdjustment.reason` (which *is* an enum — the "why did
  stock change outside a sale" categories are a small, reportable set:
  damaged/expired/lost/count-correction/other). A return's reason is more
  free-form ("wrong item," "customer changed their mind") and wasn't
  asked for as a structured field.
- **The `/returns/new` sale lookup is by sale number, not id** — the
  number is what a customer or receipt shows. This needed a small
  addition to Phase 7's `GET /api/v1/sales`: an optional `saleNumber`
  exact-match filter (`sale.service.js`), reused as-is rather than adding
  a second lookup route.
- **No new Prisma models this phase.** Every dashboard/report/audit number
  is computed from Phases 1-8's existing data — same "single source of
  truth, computed not cached" reasoning as Phase 5's inventory aggregation
  and Phase 8's returnable-quantity computation.
- **The Dashboard is open to every role, but role-aware** — the same
  "scoped-not-gated" precedent Phase 7 set for Sales history. A Cashier
  sees their own sales-today figure plus the same low-stock/expiring
  alerts Inventory already shows everyone; Admin/Pharmacist additionally
  see store-wide revenue, the sales trend chart, and inventory value.
  Reports and the Audit Log, by contrast, are Admin/Pharmacist only —
  matching the Suppliers/Stock-In/Returns precedent — closing a gap where
  `Sidebar.jsx`'s `/reports` entry had no `roles` restriction.
- **The Audit Log is its own page (`/audit`), not a tab inside
  `/reports`.** Both are reasonable; this repo settled on separating them
  since they answer different questions ("what happened" vs. "how are we
  doing"), and it keeps each page's data-fetching independent.
- **`services/inventory.service.js`'s per-product stock/expiry
  computation is centralized in one shared helper (`getAllSummaries`)**,
  called by `getSummary` (Phase 5), and Phase 9's new `getAlertCounts`
  and `getExpiringBatches` — so the Dashboard's alert numbers and the
  Inventory page's badges can never drift apart by computing the same
  thing two different ways.
- **The Audit Log merges two Prisma models (`StockAdjustment`,
  `SaleReturn`) in application code, not a raw SQL `UNION`.** It fetches
  the most recent `page * pageSize` rows from each (already indexed and
  sorted `createdAt desc` by their own services), tags each with a `type`
  discriminator, merge-sorts, and slices to the requested page — correct
  at any page depth, cheap at this app's scale, and avoids introducing
  the codebase's first raw query for what's still a modest list.
- **Sales trend and sales-report day-bucketing happens in JS, in UTC, not
  SQL `date_trunc`.** Matches the existing "compute in JS" style (Phase
  5's inventory aggregation is JS too) — but bucket *boundaries* must be
  computed in UTC to stay consistent with how `Date.prototype.toISOString()`
  reads a bucket key back out of a stored UTC timestamp; building them in
  local time caused a real bug during this phase's verification (see the
  Phase 9 testing checklist) on a server whose timezone is ahead of UTC.
- **Sales report profit does not net out returns.** `getSalesReport`
  computes revenue/cost/profit from `Sale`/`SaleItem`/`SaleItemBatch`
  only; `SaleReturn` refunds aren't subtracted. Stated as a known
  simplification — same spirit as Phase 6's cart stock check being "a
  soft guard, not a true reservation system" — rather than silently wrong.
- **`lib/utils.js` consolidates `formatCurrency`/`formatDate`**, which had
  previously been copy-pasted as a local `formatMoney`/`formatDate`
  function in nearly every page component since Phase 4. Existing pages
  were left as-is (not worth the churn of a drive-by refactor); new Phase
  9 pages use the shared version.
- **Mobile auth is an explicit opt-in (`X-Client-Type: mobile`), not an
  always-on addition.** `login`/`refresh` either set cookies and keep
  tokens out of the response body (web, default) or return tokens in the
  body and set no cookies (mobile) — never both for the same request.
  Always returning tokens in the body regardless of client would have
  quietly undone the reason cookies are httpOnly in the first place
  (`lib/auth.js`'s Phase 2 comment: keeping tokens "out of reach of
  XSS") — any script running on the page could then read them straight
  out of a `fetch()` response, for a client (the web app) that would
  never have used them anyway.
- **Every other route needed zero changes for Bearer auth to work.**
  `getAuthUser()` (`lib/auth.js`) and `proxy.js` are the only two places
  that ever read a token, so both gained one fallback step each — check
  `Authorization: Bearer <token>` when there's no cookie — and every
  route, service, and `requireRole()` call downstream is unaffected and
  doesn't know which transport authenticated the request. This is what
  makes the README's original "integrate later without duplicating
  logic" claim (Phase 1) literally true rather than aspirational.
- **No backend changes for barcode scanning or thermal printing.** Phase
  6 already built the barcode lookup convention
  (`GET /api/v1/products?search=`, exact-match on `barcode`) and Phase 7
  already built the complete structured receipt
  (`GET /api/v1/sales/:id`) — both are plain REST, already usable by any
  client. Actual device I/O (camera/Bluetooth scanning, ESC/POS command
  generation, printer connectivity) is the Flutter app's job, not this
  backend's; inventing new backend surface area for hardware it never
  talks to directly would be scope creep. `API.md`'s Hardware Integration
  section documents both contracts explicitly instead.
- **API documentation is a hand-written `API.md`, not a generated OpenAPI
  spec.** Faster to produce and keep in sync by hand than standing up
  schema-to-OpenAPI generation for a Zod-validated Next.js API (no such
  generator exists in this stack today), and a Flutter developer reading
  prose with example shapes needs no additional tooling to consume it.
- **Env validation runs in `instrumentation.js`'s `register()`, confirmed
  in the Next.js docs to run once at server boot and complete *before*
  the server accepts any request** — not a defensive check lazily placed
  inside `lib/jwt.js` that would only fire reactively on whichever
  request happened to import it first. This closes a real latent bug:
  `lib/jwt.js` encodes `ACCESS_TOKEN_SECRET`/`REFRESH_TOKEN_SECRET`
  directly with no existence check, so an unset secret in a fresh
  deployment would have silently signed every token with the literal
  string `"undefined"` as the key — forgeable by anyone who guessed that.
- **The login rate limiter is a plain in-memory `Map` stashed on
  `globalThis`**, the same pattern `lib/prisma.js` already uses so its
  client singleton survives Next dev's module hot-reload. Explicitly a
  single-instance solution — correct for this app's current scale, and
  documented as the first thing to swap for a shared store (Redis) if
  this ever runs behind more than one server process. It counts every
  login attempt, success or failure, against a 15-minute/10-attempt
  window per client IP (`x-forwarded-for`, normalizing the IPv4-mapped
  IPv6 form some proxies report so the same real client can't get split
  across two buckets) — generous enough that a legitimate user mistyping
  their password a few times never notices, while a credential-stuffing
  script does.
- **Security headers are static config in `next.config.mjs`
  (`X-Frame-Options`, `X-Content-Type-Options`, `Referrer-Policy`,
  `Permissions-Policy`, plus `Strict-Transport-Security` in production
  only), not a CSP.** Next's `headers()` config applies to every route by
  default with zero runtime cost and nothing to remember to call per
  route. A real Content-Security-Policy was deliberately left out this
  phase — `recharts` (Phase 9) and other inline-styled elements would
  likely need `'unsafe-inline'` for `style-src` or a nonce-based approach
  to keep working, and that needs careful per-page verification rather
  than a same-day addition alongside everything else here.
- **bcrypt cost factor moved from 10 to 12** (`services/user.service.js`,
  `prisma/seed.mjs`) — 12 is the current well-established modern default.
  No migration needed: bcrypt's hash format self-describes its own cost
  factor, so existing users' hashes at cost 10 keep verifying correctly
  right alongside new ones at cost 12.
- **Password policy (8+ characters, no complexity rules) and rate
  limiting scope (login only) were both deliberate, not deferred by
  oversight.** Length-only is current OWASP guidance — composition rules
  mostly just push users toward predictable patterns like `Password1!`.
  Broader rate limiting (every mutating endpoint) was considered and
  skipped for this pass: login is the highest-value brute-force target by
  a wide margin, and blanket-limiting every write risked flagging real
  usage (e.g. a busy POS checkout flow) without a clear benefit.
- **Tests hit a real running server over HTTP, not direct route-handler
  calls.** `next/headers`'s `cookies()`/`headers()` only work inside
  Next's own request-scoped context — calling an exported `POST`/`GET`
  directly from a plain Vitest process throws. A real server also
  validates the *actual* deployed behavior (response envelope shapes,
  route wiring, RBAC gate placement), which is exactly the class of bug
  this project has hit before (Phase 9's `apiSuccess({report})` vs.
  `apiSuccess(report)` mismatch) and that a handler-level test would miss.
- **The test server is a real `next build` + `next start`, not
  `next dev`.** `next dev` compiles each route on its first hit, and
  under this suite's request volume that on-demand compile was observed
  to block the server's request handling for *minutes* at a time — not
  a few seconds, an outright hang. A pre-built server has every route
  already compiled, eliminating that failure class entirely.
- **Both test servers refuse to build while a regular `next dev` is
  running, rather than silently proceeding or killing it.** A concurrent
  `next build` — even into its own separate `distDir` — was found to
  corrupt the build (garbled CSS, a bogus prerender `TypeError` on `/`)
  from both processes contending for the same source files during
  compilation. Since the test setup doesn't own that dev-server process,
  it fails fast with a clear, actionable message instead of quietly
  killing something it wasn't asked to.
- **`NODE_ENV` is explicitly stripped from the test build's environment,
  not inherited from `.env`.** `.env`'s `NODE_ENV="development"` is meant
  for `next dev`; forwarding it into `next build`/`next start`'s child
  process environment fought with Next's own internal expectation that
  it controls `NODE_ENV` itself for those commands, and broke static
  prerendering of `/` outright. `next build`/`next start` need to own
  this value.
- **`next build && next start` is run as two separate steps, not one
  chained shell command.** On this project's already-flagged slow
  filesystem, the shell `&&` only waits for the build process's exit
  code — not for its output to be fully flushed and visible on disk.
  `next start` launched immediately after intermittently read a
  half-written build (`"client reference manifest ... does not exist"`).
  Running the build to completion as its own step before the server ever
  starts removes that race.
- **The E2E test explicitly opts a locally-built production server into
  insecure cookies (`COOKIE_SECURE=false`, `lib/auth.js`) — real
  deployments never set this.** `next start` always runs as
  `NODE_ENV=production` internally, which correctly marks session
  cookies `Secure` — and every client then correctly *refuses* to send
  a `Secure` cookie back over this local test server's plain HTTP. That
  isn't a bug in cookie handling; it's a real gap between "this is a
  production build" and "this connection is actually HTTPS," which only
  a real deployment behind TLS can guarantee. The API suite never hit
  this because it authenticates entirely via `Authorization: Bearer`
  (Phase 10's mobile mode) — the E2E test is the only place this app's
  cookie-based web login is actually exercised end-to-end.
- **The E2E browser is Playwright's bundled Chromium, not the system
  `msedge` channel** every ad-hoc verification script this project used
  through Phase 11. `msedge` left the Playwright test *worker* process
  unable to exit cleanly — a 5-minute force-kill on every single run —
  the same family of leftover-process quirk already seen with ad-hoc
  msedge scripts earlier in this project. Chromium is Playwright's
  primary supported path with reliable process lifecycle management
  from the test runner itself.
- **Auth-heavy test files (`auth.test.js`, `rate-limit.test.js`, and any
  file that logs in beyond the three shared role tokens) use a synthetic
  `X-Forwarded-For` header to isolate their login attempts from the
  Phase 11 rate limiter's shared bucket.** Next's dev/prod server
  auto-populates that header from the real local socket for same-machine
  connections, so every test file's login traffic would otherwise land
  in the *same* bucket — `auth.test.js` alone makes 7 login-adjacent
  calls, which would already brush the 10-attempt cap before
  `rate-limit.test.js` even got to make its own deliberate 11. This is
  also why role tokens are obtained **once**, in `globalSetup`, and
  reused by every other test file rather than logging in per-file.

## Post-Phase-12: client-only POS cart

Not one of the 12 planned phases — a targeted follow-up once the app was
feature-complete, prompted by the POS feeling slow in practice.

- **`Cart`/`CartItem` were removed from the schema entirely (migration
  `remove_cart`), not just stopped being used.** Every cart interaction
  (add, +/-, remove, clear) previously round-tripped to Postgres, because
  Phase 6 deliberately persisted the cart so a refresh mid-sale wouldn't
  lose it. Paying a full DB write on every click was the wrong trade for
  a POS that needs to feel instant while scanning items. Cart state now
  lives entirely in the browser (`app/(app)/pos/page.js`'s own React
  state, mirrored to `sessionStorage`) until the moment of checkout —
  same refresh-survival property, zero network cost to get it. Leaving
  the tables in place unused was considered and rejected: dead tables
  invite someone "fixing" a bug against data nothing reads anymore.
- **`POST /api/v1/sales` now takes `items: [{ productId, quantity }]`
  directly in the body instead of reading a server-side cart.**
  `saleService.checkout`'s actual transaction — re-validate stock via
  `inventoryService.getFefoAllocation`, create `Sale`/`SaleItem`/
  `SaleItemBatch` atomically — is untouched. Only where the line items
  come from changed; checkout was always the real enforcement point
  regardless.
- **The add-time "only N in stock" soft guard is gone, not relocated.**
  With no server-side cart there's nowhere natural to run it without
  reintroducing a network call per add-to-cart click — which would undo
  the whole point of this change. Checkout's existing atomic
  re-validation (unchanged) is now the *only* stock check, exactly as it
  already was the only check that actually mattered: a cashier can add
  more than what's on hand and only find out at checkout, which names
  the exact shortfall and leaves the cart untouched to adjust and retry.
- **sessionStorage, not localStorage or pure in-memory state.** Survives
  a refresh or accidental back-navigation (unlike plain React state, which
  a refresh wipes), but clears when the tab closes (unlike localStorage,
  which would leak an abandoned cart into a cashier's *next* shift on a
  shared terminal).
