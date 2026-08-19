# MedCare Pharmacy — API Reference

A standalone reference for building a client against this backend — the
planned Flutter app, or anything else. The web app in this repo is just
one client of the same API; nothing here is web-specific except the
optional cookie auth mode.

## Base URL & versioning

All routes are under `/api/v1`. There is no version negotiation — a
breaking change would ship as `/api/v2`.

## Response envelope

Every route returns one of these two shapes, always with a `200`-range
or error status code (never a bare error with a `200`):

```json
// success
{ "success": true, "message": "", "data": {} }

// error
{ "success": false, "message": "", "errors": [] }
```

`errors` is populated for `422` validation failures — an array of
`{ "field": "path.to.field", "message": "..." }`. For nested array fields
(e.g. a stock-in line item), the field path looks like `items[1].productId`.

Common status codes across every route: `401` (not authenticated), `403`
(authenticated, wrong role), `404` (not found — or authenticated but not
permitted to know whether it exists, e.g. another cashier's sale), `422`
(validation failed), `405` (method not implemented — several resources
are intentionally immutable, see their sections below).

## Authentication

There are two mutually-exclusive modes, chosen per-request by whether
the request carries an `X-Client-Type: mobile` header on the three auth
routes. **Every other route works identically regardless of which mode
was used to log in** — once you have an access token, `GET /api/v1/products`
(for example) doesn't know or care whether it arrived as a cookie or a
Bearer header.

### Web mode (default — no `X-Client-Type` header)

`POST /api/v1/auth/login` sets two httpOnly cookies (`access_token`,
15 min; `refresh_token`, 7 days) and the response body contains only
`{ "user": {...} }` — the raw tokens are never exposed to page JS, on
purpose (keeps them out of reach of XSS). Not relevant to a Flutter
client; skip to mobile mode below.

### Mobile mode (`X-Client-Type: mobile` header)

No cookies are set at all. Tokens are returned in the response body for
the app to store itself (e.g. `flutter_secure_storage`) and send back as
`Authorization: Bearer <accessToken>` on every subsequent request.

**`POST /api/v1/auth/login`**
Headers: `X-Client-Type: mobile`
Body: `{ "email": string, "password": string }`
Response `data`: `{ "user": {id,name,email,role}, "accessToken": string, "refreshToken": string }`
`401` on wrong email/password (generic message either way — doesn't
reveal whether the email exists).

**`POST /api/v1/auth/refresh`**
Headers: `X-Client-Type: mobile`
Body: `{ "refreshToken": string }`
Response `data`: same shape as login, with a **new** access+refresh pair.
The old refresh token is revoked as part of this call (rotation) — reusing
it afterward returns `401`. Call this when a protected request comes back
`401` with an expired-looking access token; if refresh also fails, the
session is gone and the app should return to login.

**`POST /api/v1/auth/logout`**
Headers: `X-Client-Type: mobile`
Body: `{ "refreshToken": string }`
Revokes that refresh token server-side. Best-effort — a missing or
already-revoked token still returns `200`.

**`GET /api/v1/auth/me`**
Headers: `Authorization: Bearer <accessToken>`
Response `data`: `{ "user": {id,name,email,role} }`. Useful on app launch
to check a stored access token is still valid without a full refresh
round-trip; `401` if it's expired or invalid (then call refresh).

### Roles

`ADMIN`, `PHARMACIST`, `CASHIER`. Every endpoint below states which
roles it accepts; "any role" means any authenticated user regardless of
role.

## Users — Admin only

- **`GET /api/v1/users`** — list. No pagination (small table).
- **`POST /api/v1/users`** — `{ name, email, password (min 8 chars), role }`.
  No self-signup exists anywhere in the system; every account is
  provisioned this way.

## Categories — read: any role; write: Admin/Pharmacist

- **`GET /api/v1/categories`** — `?search=&isActive=true|false`
- **`POST /api/v1/categories`** — `{ name, description? }`
- **`PATCH /api/v1/categories/:id`** — any subset of create fields plus
  `isActive` (deactivate/reactivate — there is no `DELETE`)

## Manufacturers — read: any role; write: Admin/Pharmacist

Same shape as Categories: `GET /`, `POST /`, `PATCH /:id`.

## Products — read: any role; write: Admin/Pharmacist

- **`GET /api/v1/products`** — `?search=&categoryId=&manufacturerId=&isActive=&page=&pageSize=`.
  `search` matches name/genericName/barcode. **This is the barcode lookup
  endpoint** — see Hardware Integration below.
- **`POST /api/v1/products`** — `{ name, genericName?, categoryId,
  manufacturerId, unitOfMeasure, barcode?, costPrice, sellingPrice,
  taxRate?, reorderLevel?, description? }`.
  `unitOfMeasure` ∈ `TABLET, CAPSULE, BOTTLE, VIAL, TUBE, BOX, STRIP, ML, MG, G, UNIT`.
  `409` on a duplicate `(name, manufacturerId)` pair or duplicate barcode.
- **`PATCH /api/v1/products/:id`** — any subset of create fields plus `isActive`

## Suppliers — Admin/Pharmacist only (no Cashier access at all, not even read)

- **`GET /api/v1/suppliers`** — `?search=&isActive=`
- **`POST /api/v1/suppliers`** — `{ name, contactPerson?, phone?, email?, address? }`
- **`PATCH /api/v1/suppliers/:id`** — any subset plus `isActive`

## Stock-In — Admin/Pharmacist only

Receiving a delivery creates a `StockIn` header and one `Batch` per line
item atomically. **Immutable — no `PATCH`/`DELETE`**; a received-quantity
correction is a Stock Adjustment (below), not an edit.

- **`GET /api/v1/stock-ins`** — `?supplierId=&page=&pageSize=`
- **`GET /api/v1/stock-ins/:id`** — full receipt with line items
- **`POST /api/v1/stock-ins`** — `{ supplierId, referenceNumber?, receivedAt?, notes?, items: [{ productId, batchNumber, expiryDate, manufacturingDate?, quantityReceived, costPricePerUnit }] }`

## Batches — Admin/Pharmacist only, read-only

- **`GET /api/v1/batches`** — `?productId=&supplierId=&page=&pageSize=`
- **`GET /api/v1/batches/:id`**

## Inventory — any role, read-only

Stock-on-hand and expiry status, computed live from `Batch` data (never
cached).

- **`GET /api/v1/inventory`** — `?search=&stockStatus=OUT|LOW|OK&page=&pageSize=`.
  Per-product `totalRemaining`, `stockStatus`, `expiringSoonCount`, `expiredCount`.
- **`GET /api/v1/inventory/products/:id/batches`** — that product's
  batches in FEFO order (soonest expiry first), each with a computed
  `status` (`EXPIRED`/`EXPIRING_SOON`/`OK`)
- **`GET /api/v1/inventory/products/:id/fefo?quantity=N`** — read-only
  preview of how a FEFO allocation of `N` units would split across
  batches; `sufficient: false` with a partial allocation if `N` exceeds
  what's on hand (never errors on insufficient stock — the caller decides
  what to do)

## Sales — any role (Cashiers see only their own; Admin/Pharmacist see everyone's)

There is no server-side cart — a client (the web POS, or a Flutter app)
builds up its own line items locally and sends them all at once to
checkout. Checkout is the app's one multi-step transaction: re-validates
stock, creates the `Sale` + `SaleItem`s + FEFO `SaleItemBatch`
allocations, decrements every allocated batch — all or nothing.
**Immutable once created — no `PATCH`/`DELETE`**; corrections are a Sale
Return (below).

- **`GET /api/v1/sales`** — `?saleNumber=&page=&pageSize=`
- **`GET /api/v1/sales/:id`** — full receipt (line items, totals, payment). This is the thermal-receipt data contract — see Hardware Integration.
- **`POST /api/v1/sales`** — `{ paymentMethod: "CASH"|"CARD", amountTendered? (required for CASH), items: [{ productId, quantity }] }`.
  `422` if `items` is empty, a `productId` doesn't exist, or any line's
  stock is insufficient (names the exact product/quantity short) —
  nothing is written on failure. This is the *only* stock check; there's
  no separate "add to cart" step or pre-check to soft-guard against.
- **`GET /api/v1/sales/:id/returnable`** *(Admin/Pharmacist)* — per-line
  `returnedQuantity`/`returnableQuantity`, the lookup step before
  processing a return

## Stock Adjustments — Admin/Pharmacist only

Manual batch corrections (damage, expiry write-off, loss, count error).
**Immutable — no `PATCH`/`DELETE`**; a mistaken adjustment is corrected by
posting another one in the opposite direction.

- **`GET /api/v1/stock-adjustments`** — `?batchId=&page=&pageSize=`
- **`POST /api/v1/stock-adjustments`** — `{ batchId, quantityChange (nonzero int, negative to remove), reason, notes? }`.
  `reason` ∈ `DAMAGED, EXPIRED, LOST_STOLEN, COUNT_CORRECTION, OTHER`.
  `422` if the adjustment would take `quantityRemaining` negative.

## Sale Returns — Admin/Pharmacist only

Line-item, partial-quantity returns against a completed sale. Restocking
(when requested) reverses the *exact* original FEFO allocation, batch by
batch, most-recent-expiry-first, capped at what each batch actually gave
up — see `services/saleReturn.service.js` for the full algorithm.
**Immutable — no `PATCH`/`DELETE`.**

- **`GET /api/v1/sale-returns`** — `?page=&pageSize=`
- **`GET /api/v1/sale-returns/:id`**
- **`POST /api/v1/sale-returns`** — `{ saleId, reason?, refundMethod: "CASH"|"CARD", items: [{ saleItemId, quantity, restock? (default true) }] }`.
  Refund amounts are always server-computed from the sale item's
  snapshotted price/tax — never trust a client-supplied amount. `422`
  naming the line if `quantity` exceeds what's still returnable.

## Dashboard — stats/alerts: any role; sales-trend: Admin/Pharmacist

Role-aware, not role-gated — mirrors Sales' visibility pattern.

- **`GET /api/v1/dashboard/stats`** — Cashier gets `{ lowStockCount, outOfStockCount, expiringSoonCount, expiredCount, mySalesToday: {count,total} }`; Admin/Pharmacist additionally get `todaysSales` (store-wide), `monthRevenue`, `inventoryValue` (cost basis) instead of `mySalesToday`.
- **`GET /api/v1/dashboard/alerts`** — `{ lowStock: [...], expiringSoon: [...] }`, top 5 of each
- **`GET /api/v1/dashboard/sales-trend?days=14`** — array of `{ date, revenue, salesCount }`, one entry per day, zero-filled

## Reports — Admin/Pharmacist only

- **`GET /api/v1/reports/sales?from=&to=`** — defaults to a trailing 30-day
  window if omitted. `{ from, to, totals: {revenue,tax,cost,profit,saleCount}, daily: [...] }`.
  `profit` does not net out Sale Return refunds (a known simplification).
- **`GET /api/v1/reports/inventory-valuation`** — point-in-time, no date
  range. `{ products: [{product,category,quantityRemaining,costValue,retailValue}], totals: {costValue,retailValue} }`
- **`GET /api/v1/reports/top-products?from=&to=&limit=10`** — array of
  `{ product, quantitySold, revenue }`, sorted by revenue desc

## Audit Log — Admin/Pharmacist only

- **`GET /api/v1/audit-log?page=&pageSize=`** — Stock Adjustments and
  Sale Returns merged into one feed, each entry tagged `"type": "STOCK_ADJUSTMENT" | "SALE_RETURN"`,
  sorted `createdAt` desc. `{ entries, total, page, pageSize }`.

## Health

- **`GET /api/v1/health`** — no auth required. `{ status, database: "connected"|"unreachable", timestamp }`

## Hardware integration

This backend doesn't talk to hardware directly — a barcode scanner and a
thermal printer are both the client's concern. What it provides is the
data contract each one needs:

**Barcode scanning**: however the Flutter app captures a code (camera,
Bluetooth HID scanner, manual entry), look it up with
`GET /api/v1/products?search=<code>` and check the result set for an
exact `barcode` field match — the same convention the web POS uses for
keyboard-wedge scanners. Don't add the top fuzzy-search result if there's
no exact match; that's how you'd sell the wrong product.

**Thermal receipts**: `GET /api/v1/sales/:id` returns everything a
receipt needs — line items, quantities, unit price, tax, subtotal, total,
payment method, amount tendered/change for cash. Turning that into ESC/POS
commands (or handing it to a Bluetooth/USB print SDK) is entirely the
app's job; this backend has no printer-specific endpoint and doesn't need
one — the data is already complete and stable.
