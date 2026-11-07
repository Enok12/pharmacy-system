"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { Receipt, ChevronLeft, ChevronRight } from "lucide-react";
import PageLayout from "@/components/layout/PageLayout";
import Card, { CardBody } from "@/components/ui/Card";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import { TableSkeleton } from "@/components/feedback/LoadingState";
import ErrorState from "@/components/feedback/ErrorState";
import EmptyState from "@/components/feedback/EmptyState";

const PAGE_SIZE = 20;

function formatDate(value) {
  return new Date(value).toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatMoney(value) {
  return new Intl.NumberFormat(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(
    value
  );
}

/**
 * No server wrapper — visibility is role-scoped, not role-gated. Cashier
 * only ever sees their own sales (enforced server-side by saleService.list),
 * Admin/Pharmacist see everyone's, same list either way.
 */
export default function SalesHistoryPage() {
  const [result, setResult] = useState(null);
  const [error, setError] = useState(false);
  const [page, setPage] = useState(1);

  const load = useCallback(async () => {
    try {
      const params = new URLSearchParams({ page: String(page), pageSize: String(PAGE_SIZE) });
      const res = await fetch(`/api/v1/sales?${params}`);
      const json = await res.json();
      if (!json.success) throw new Error(json.message);
      setError(false);
      setResult(json.data);
    } catch {
      setError(true);
    }
  }, [page]);

  useEffect(() => {
    load();
  }, [load]);

  const totalPages = result ? Math.max(1, Math.ceil(result.total / result.pageSize)) : 1;

  return (
    <PageLayout
      title="Sales"
      description="Completed sales and receipts."
      breadcrumbs={[{ label: "Dashboard", href: "/dashboard" }, { label: "Sales" }]}
    >
      <Card>
        <CardBody>
          {result === null && !error && <TableSkeleton rows={6} columns={6} />}
          {error && <ErrorState onRetry={load} />}
          {result?.sales.length === 0 && (
            <EmptyState
              icon={Receipt}
              title="No sales yet"
              message="Completed sales will appear here."
              action={
                <Button as={Link} href="/pos">
                  Go to POS
                </Button>
              }
            />
          )}
          {result && result.sales.length > 0 && (
            <>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-[var(--color-border)] text-left text-xs font-medium uppercase tracking-wide text-[var(--color-text-muted)]">
                      <th className="py-2.5 pr-4">Date</th>
                      <th className="py-2.5 pr-4">Sale #</th>
                      <th className="py-2.5 pr-4">Cashier</th>
                      <th className="py-2.5 pr-4">Items</th>
                      <th className="py-2.5 pr-4">Payment</th>
                      <th className="py-2.5 pr-4">Total</th>
                      <th className="py-2.5 pr-4" />
                    </tr>
                  </thead>
                  <tbody>
                    {result.sales.map((sale) => (
                      <tr
                        key={sale.id}
                        className="border-b border-[var(--color-border)] last:border-0 hover:bg-[var(--color-surface-muted)]"
                      >
                        <td className="py-3 pr-4 text-[var(--color-text-secondary)]">
                          {formatDate(sale.createdAt)}
                        </td>
                        <td className="py-3 pr-4 font-medium text-[var(--color-text-primary)]">
                          #{String(sale.saleNumber).padStart(6, "0")}
                        </td>
                        <td className="py-3 pr-4 text-[var(--color-text-secondary)]">{sale.cashier.name}</td>
                        <td className="py-3 pr-4 text-[var(--color-text-secondary)]">{sale.itemCount}</td>
                        <td className="py-3 pr-4">
                          <Badge tone={sale.paymentMethod === "CASH" ? "success" : "info"}>
                            {sale.paymentMethod}
                          </Badge>
                        </td>
                        <td className="py-3 pr-4 font-medium text-[var(--color-text-primary)]">
                          {formatMoney(sale.total)}
                        </td>
                        <td className="py-3 pr-4 text-right">
                          <Link
                            href={`/sales/${sale.id}`}
                            className="text-sm font-medium text-[var(--color-brand-700)] hover:underline"
                          >
                            View
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {totalPages > 1 && (
                <div className="mt-4 flex items-center justify-between text-sm text-[var(--color-text-secondary)]">
                  <span>
                    Page {result.page} of {totalPages} ({result.total} sales)
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
    </PageLayout>
  );
}
