"use client";

import { useState, useEffect } from "react";
import PageLayout from "@/components/layout/PageLayout";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import Badge from "@/components/ui/Badge";
import LoadingState from "@/components/feedback/LoadingState";
import ErrorState from "@/components/feedback/ErrorState";
import { formatDate, formatCurrency } from "@/lib/utils";
import { ArrowLeftRight, RotateCcw } from "lucide-react";
import Link from "next/link";

export default function AuditClient() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [data, setData] = useState({ entries: [], total: 0, page: 1, pageSize: 20 });

  async function loadData(page = 1) {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/v1/audit-log?page=${page}&pageSize=20`);
      if (!res.ok) throw new Error("Failed to load audit log");

      const json = await res.json();
      setData(json.data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  if (loading && data.entries.length === 0) return <PageLayout title="Audit Log"><LoadingState label="Loading audit log..." /></PageLayout>;
  if (error && data.entries.length === 0) return <PageLayout title="Audit Log"><ErrorState message={error} onRetry={() => loadData(1)} /></PageLayout>;

  return (
    <PageLayout
      title="Audit Log"
      description="Unified feed of all stock adjustments and sale returns."
      breadcrumbs={[{ label: "Dashboard", href: "/dashboard" }, { label: "Audit Log" }]}
    >
      <Card>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-[var(--color-surface-muted)] text-[var(--color-text-secondary)]">
              <tr>
                <th className="px-4 py-3 font-medium">Date</th>
                <th className="px-4 py-3 font-medium">Type</th>
                <th className="px-4 py-3 font-medium">Description</th>
                <th className="px-4 py-3 font-medium">User</th>
                <th className="px-4 py-3 font-medium text-right">Impact</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--color-border)]">
              {data.entries.map((entry) => (
                <tr key={`${entry.type}-${entry.id}`} className="hover:bg-[var(--color-surface-muted)]">
                  <td className="px-4 py-3 text-[var(--color-text-secondary)]">
                    {formatDate(entry.createdAt)}
                  </td>
                  <td className="px-4 py-3">
                    {entry.type === "STOCK_ADJUSTMENT" ? (
                      <Badge tone="info"><ArrowLeftRight className="mr-1 h-3 w-3 inline" /> Adjustment</Badge>
                    ) : (
                      <Badge tone="warning"><RotateCcw className="mr-1 h-3 w-3 inline" /> Return</Badge>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {entry.type === "STOCK_ADJUSTMENT" ? (
                      <div>
                        <p className="text-[var(--color-text-primary)] font-medium">Batch {entry.batch.batchNumber}</p>
                        <p className="text-xs text-[var(--color-text-muted)]">Reason: {entry.reason.replace(/_/g, " ")}</p>
                      </div>
                    ) : (
                      <div>
                        <Link href={`/sales/${entry.sale.id}`} className="text-[var(--color-brand-600)] hover:underline font-medium">
                          Sale #{entry.sale.saleNumber}
                        </Link>
                        <p className="text-xs text-[var(--color-text-muted)]">Refund: {entry.refundMethod}</p>
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3 text-[var(--color-text-secondary)]">
                    {entry.type === "STOCK_ADJUSTMENT" ? entry.performedBy.name : entry.processedBy.name}
                  </td>
                  <td className="px-4 py-3 text-right">
                    {entry.type === "STOCK_ADJUSTMENT" ? (
                      <span className={`font-medium tabular-nums ${entry.quantityChange > 0 ? "text-[var(--color-success)]" : "text-[var(--color-danger)]"}`}>
                        {entry.quantityChange > 0 ? "+" : ""}{entry.quantityChange} items
                      </span>
                    ) : (
                      <span className="font-medium tabular-nums text-[var(--color-text-primary)]">
                        {formatCurrency(entry.refundAmount)}
                      </span>
                    )}
                  </td>
                </tr>
              ))}
              {data.entries.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-[var(--color-text-muted)]">
                    No audit records found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {data.total > data.pageSize && (
          <div className="flex items-center justify-between border-t border-[var(--color-border)] p-4">
            <span className="text-sm text-[var(--color-text-secondary)]">
              Showing {(data.page - 1) * data.pageSize + 1} to {Math.min(data.page * data.pageSize, data.total)} of {data.total}
            </span>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={data.page === 1}
                onClick={() => loadData(data.page - 1)}
              >
                Previous
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={data.page * data.pageSize >= data.total}
                onClick={() => loadData(data.page + 1)}
              >
                Next
              </Button>
            </div>
          </div>
        )}
      </Card>
    </PageLayout>
  );
}
