"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { Plus, PackageCheck, ChevronLeft, ChevronRight } from "lucide-react";
import PageLayout from "@/components/layout/PageLayout";
import Card, { CardBody } from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import { TableSkeleton } from "@/components/feedback/LoadingState";
import ErrorState from "@/components/feedback/ErrorState";
import EmptyState from "@/components/feedback/EmptyState";

const PAGE_SIZE = 20;

function formatDate(value) {
  return new Date(value).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export default function StockInHistoryClient() {
  const [result, setResult] = useState(null);
  const [error, setError] = useState(false);
  const [page, setPage] = useState(1);

  const load = useCallback(async () => {
    try {
      const params = new URLSearchParams({ page: String(page), pageSize: String(PAGE_SIZE) });
      const res = await fetch(`/api/v1/stock-ins?${params}`);
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
      title="Stock In"
      description="Record and review deliveries received from suppliers."
      breadcrumbs={[{ label: "Dashboard", href: "/dashboard" }, { label: "Stock In" }]}
      actions={
        <Button as={Link} href="/stock-in/new">
          <Plus className="h-4 w-4" />
          Record Stock-In
        </Button>
      }
    >
      <Card>
        <CardBody>
          {result === null && !error && <TableSkeleton rows={6} columns={5} />}
          {error && <ErrorState onRetry={load} />}
          {result?.stockIns.length === 0 && (
            <EmptyState
              icon={PackageCheck}
              title="No stock-in records yet"
              message="Receipts will appear here once you record a delivery from a supplier."
              action={
                <Button as={Link} href="/stock-in/new">
                  Record Stock-In
                </Button>
              }
            />
          )}
          {result && result.stockIns.length > 0 && (
            <>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-[var(--color-border)] text-left text-xs font-medium uppercase tracking-wide text-[var(--color-text-muted)]">
                      <th className="py-2.5 pr-4">Date</th>
                      <th className="py-2.5 pr-4">Supplier</th>
                      <th className="py-2.5 pr-4">Reference</th>
                      <th className="py-2.5 pr-4">Items</th>
                      <th className="py-2.5 pr-4">Received by</th>
                      <th className="py-2.5 pr-4" />
                    </tr>
                  </thead>
                  <tbody>
                    {result.stockIns.map((stockIn) => (
                      <tr
                        key={stockIn.id}
                        className="border-b border-[var(--color-border)] last:border-0 hover:bg-[var(--color-surface-muted)]"
                      >
                        <td className="py-3 pr-4 text-[var(--color-text-secondary)]">
                          {formatDate(stockIn.receivedAt)}
                        </td>
                        <td className="py-3 pr-4 font-medium text-[var(--color-text-primary)]">
                          {stockIn.supplier.name}
                        </td>
                        <td className="py-3 pr-4 text-[var(--color-text-secondary)]">
                          {stockIn.referenceNumber || "—"}
                        </td>
                        <td className="py-3 pr-4 text-[var(--color-text-secondary)]">
                          {stockIn.itemCount}
                        </td>
                        <td className="py-3 pr-4 text-[var(--color-text-secondary)]">
                          {stockIn.receivedBy.name}
                        </td>
                        <td className="py-3 pr-4 text-right">
                          <Link
                            href={`/stock-in/${stockIn.id}`}
                            className="inline-flex items-center gap-1 text-sm font-medium text-[var(--color-brand-700)] hover:underline"
                          >
                            View
                            <ChevronRight className="h-3.5 w-3.5" />
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
                    Page {result.page} of {totalPages} ({result.total} records)
                  </span>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={page <= 1}
                      onClick={() => setPage((p) => p - 1)}
                    >
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
