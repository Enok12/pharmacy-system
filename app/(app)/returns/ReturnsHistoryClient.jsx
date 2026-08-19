"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { Plus, RotateCcw, ChevronLeft, ChevronRight } from "lucide-react";
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

export default function ReturnsHistoryClient() {
  const [result, setResult] = useState(null);
  const [error, setError] = useState(false);
  const [page, setPage] = useState(1);

  const load = useCallback(async () => {
    try {
      const params = new URLSearchParams({ page: String(page), pageSize: String(PAGE_SIZE) });
      const res = await fetch(`/api/v1/sale-returns?${params}`);
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
      title="Returns"
      description="Sales returns processed and their refunds."
      breadcrumbs={[{ label: "Dashboard", href: "/dashboard" }, { label: "Returns" }]}
      actions={
        <Button as={Link} href="/returns/new">
          <Plus className="h-4 w-4" />
          Process Return
        </Button>
      }
    >
      <Card>
        <CardBody>
          {result === null && !error && <TableSkeleton rows={6} columns={6} />}
          {error && <ErrorState onRetry={load} />}
          {result?.returns.length === 0 && (
            <EmptyState
              icon={RotateCcw}
              title="No returns yet"
              message="Processed sales returns will appear here."
              action={
                <Button as={Link} href="/returns/new">
                  Process Return
                </Button>
              }
            />
          )}
          {result && result.returns.length > 0 && (
            <>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-[var(--color-border)] text-left text-xs font-medium uppercase tracking-wide text-[var(--color-text-muted)]">
                      <th className="py-2.5 pr-4">Date</th>
                      <th className="py-2.5 pr-4">Sale #</th>
                      <th className="py-2.5 pr-4">Processed by</th>
                      <th className="py-2.5 pr-4">Items</th>
                      <th className="py-2.5 pr-4">Refund</th>
                      <th className="py-2.5 pr-4" />
                    </tr>
                  </thead>
                  <tbody>
                    {result.returns.map((saleReturn) => (
                      <tr
                        key={saleReturn.id}
                        className="border-b border-[var(--color-border)] last:border-0 hover:bg-[var(--color-surface-muted)]"
                      >
                        <td className="py-3 pr-4 text-[var(--color-text-secondary)]">
                          {formatDate(saleReturn.createdAt)}
                        </td>
                        <td className="py-3 pr-4 font-medium text-[var(--color-text-primary)]">
                          #{String(saleReturn.sale.saleNumber).padStart(6, "0")}
                        </td>
                        <td className="py-3 pr-4 text-[var(--color-text-secondary)]">
                          {saleReturn.processedBy.name}
                        </td>
                        <td className="py-3 pr-4 text-[var(--color-text-secondary)]">
                          {saleReturn.itemCount}
                        </td>
                        <td className="py-3 pr-4">
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-[var(--color-text-primary)]">
                              {formatMoney(saleReturn.refundAmount)}
                            </span>
                            <Badge tone={saleReturn.refundMethod === "CASH" ? "success" : "info"}>
                              {saleReturn.refundMethod}
                            </Badge>
                          </div>
                        </td>
                        <td className="py-3 pr-4 text-right">
                          <Link
                            href={`/returns/${saleReturn.id}`}
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
                    Page {result.page} of {totalPages} ({result.total} returns)
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
