"use client";

import { useEffect, useState, useCallback } from "react";
import { Boxes, ChevronLeft, ChevronRight } from "lucide-react";
import PageLayout from "@/components/layout/PageLayout";
import Card, { CardBody } from "@/components/ui/Card";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import { TableSkeleton } from "@/components/feedback/LoadingState";
import ErrorState from "@/components/feedback/ErrorState";
import EmptyState from "@/components/feedback/EmptyState";
import BatchesModal from "./BatchesModal";

const PAGE_SIZE = 20;

const STOCK_BADGE = {
  OUT: { tone: "danger", label: "Out of stock" },
  LOW: { tone: "warning", label: "Low stock" },
  OK: { tone: "success", label: "In stock" },
};

function formatDate(value) {
  if (!value) return "—";
  return new Date(value).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

export default function InventoryPageClient({ canAdjust }) {
  const [result, setResult] = useState(null);
  const [error, setError] = useState(false);
  const [search, setSearch] = useState("");
  const [stockStatus, setStockStatus] = useState("");
  const [page, setPage] = useState(1);
  const [viewingProduct, setViewingProduct] = useState(null);

  const load = useCallback(async () => {
    try {
      const params = new URLSearchParams({ page: String(page), pageSize: String(PAGE_SIZE) });
      if (search) params.set("search", search);
      if (stockStatus) params.set("stockStatus", stockStatus);
      const res = await fetch(`/api/v1/inventory?${params}`);
      const json = await res.json();
      if (!json.success) throw new Error(json.message);
      setError(false);
      setResult(json.data);
    } catch {
      setError(true);
    }
  }, [search, stockStatus, page]);

  useEffect(() => {
    load();
  }, [load]);

  const totalPages = result ? Math.max(1, Math.ceil(result.total / result.pageSize)) : 1;

  return (
    <PageLayout
      title="Inventory"
      description="Stock on hand and expiry status across your product catalog."
      breadcrumbs={[{ label: "Dashboard", href: "/dashboard" }, { label: "Inventory" }]}
    >
      <Card>
        <CardBody>
          <div className="mb-4 flex flex-wrap items-center gap-3">
            <input
              type="text"
              value={search}
              onChange={(e) => {
                setPage(1);
                setSearch(e.target.value);
              }}
              placeholder="Search by name or generic name..."
              className="h-10 w-full max-w-sm rounded-lg border border-[var(--color-border)] bg-white px-3 text-sm text-[var(--color-text-primary)] focus:border-[var(--color-brand-600)] focus:outline-none focus:ring-2 focus:ring-[var(--color-brand-600)]/20"
            />
            <select
              value={stockStatus}
              onChange={(e) => {
                setPage(1);
                setStockStatus(e.target.value);
              }}
              className="h-10 rounded-lg border border-[var(--color-border)] bg-white px-3 text-sm text-[var(--color-text-primary)] focus:border-[var(--color-brand-600)] focus:outline-none focus:ring-2 focus:ring-[var(--color-brand-600)]/20"
            >
              <option value="">All stock levels</option>
              <option value="LOW">Low stock</option>
              <option value="OUT">Out of stock</option>
            </select>
          </div>

          {result === null && !error && <TableSkeleton rows={6} columns={6} />}
          {error && <ErrorState onRetry={load} />}
          {result?.products.length === 0 && (
            <EmptyState
              icon={Boxes}
              title="No products found"
              message="Once products have stock received via Stock In, they'll appear here."
            />
          )}
          {result && result.products.length > 0 && (
            <>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-[var(--color-border)] text-left text-xs font-medium uppercase tracking-wide text-[var(--color-text-muted)]">
                      <th className="py-2.5 pr-4">Product</th>
                      <th className="py-2.5 pr-4">Category</th>
                      <th className="py-2.5 pr-4">Total stock</th>
                      <th className="py-2.5 pr-4">Reorder level</th>
                      <th className="py-2.5 pr-4">Status</th>
                      <th className="py-2.5 pr-4" />
                    </tr>
                  </thead>
                  <tbody>
                    {result.products.map((product) => {
                      const badge = STOCK_BADGE[product.stockStatus];
                      return (
                        <tr key={product.id} className="border-b border-[var(--color-border)] last:border-0">
                          <td className="py-3 pr-4">
                            <p className="font-medium text-[var(--color-text-primary)]">{product.name}</p>
                            {product.genericName && (
                              <p className="text-xs text-[var(--color-text-muted)]">{product.genericName}</p>
                            )}
                          </td>
                          <td className="py-3 pr-4 text-[var(--color-text-secondary)]">
                            {product.category.name}
                          </td>
                          <td className="py-3 pr-4 text-[var(--color-text-secondary)]">
                            {product.totalRemaining} {product.unitOfMeasure}
                          </td>
                          <td className="py-3 pr-4 text-[var(--color-text-secondary)]">
                            {product.reorderLevel}
                          </td>
                          <td className="py-3 pr-4">
                            <div className="flex flex-wrap gap-1.5">
                              <Badge tone={badge.tone}>{badge.label}</Badge>
                              {product.expiredCount > 0 && (
                                <Badge tone="danger">
                                  {product.expiredCount} expired
                                </Badge>
                              )}
                              {product.expiringSoonCount > 0 && (
                                <Badge tone="warning">
                                  {product.expiringSoonCount} expiring soon
                                </Badge>
                              )}
                            </div>
                            {product.nearestExpiry && (
                              <p className="mt-1 text-xs text-[var(--color-text-muted)]">
                                Nearest expiry: {formatDate(product.nearestExpiry)}
                              </p>
                            )}
                          </td>
                          <td className="py-3 pr-4 text-right">
                            <Button variant="outline" size="sm" onClick={() => setViewingProduct(product)}>
                              View Batches
                            </Button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {totalPages > 1 && (
                <div className="mt-4 flex items-center justify-between text-sm text-[var(--color-text-secondary)]">
                  <span>
                    Page {result.page} of {totalPages} ({result.total} products)
                  </span>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
                      <ChevronLeft className="h-4 w-4" />
                      Previous
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={page >= totalPages}
                      onClick={() => setPage((p) => p + 1)}
                    >
                      Next
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </CardBody>
      </Card>

      <BatchesModal
        productId={viewingProduct?.id}
        productName={viewingProduct?.name}
        isOpen={Boolean(viewingProduct)}
        onClose={() => setViewingProduct(null)}
        canAdjust={canAdjust}
      />
    </PageLayout>
  );
}
