// Shared display formatters — consolidates the `formatMoney`/`formatDate`
// helpers that were previously copy-pasted per-page (StockInDetailClient,
// ReturnsHistoryClient, ...) into one place for Phase 9's new pages.
export function formatCurrency(value) {
  return new Intl.NumberFormat(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value ?? 0);
}

export function formatDate(value) {
  if (!value) return "—";
  return new Date(value).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}
