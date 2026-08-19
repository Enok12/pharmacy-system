"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import PageLayout from "@/components/layout/PageLayout";
import Card, { CardBody, CardHeader } from "@/components/ui/Card";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import LoadingState from "@/components/feedback/LoadingState";
import ErrorState from "@/components/feedback/ErrorState";

function formatDate(value) {
  if (!value) return "—";
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

export default function ReturnDetailClient({ id }) {
  const [saleReturn, setSaleReturn] = useState(null);
  const [error, setError] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/v1/sale-returns/${id}`);
      const json = await res.json();
      if (!json.success) throw new Error(json.message);
      setError(false);
      setSaleReturn(json.data.saleReturn);
    } catch {
      setError(true);
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <PageLayout
      title="Return Receipt"
      breadcrumbs={[
        { label: "Dashboard", href: "/dashboard" },
        { label: "Returns", href: "/returns" },
        { label: "Receipt" },
      ]}
      actions={
        <Button as={Link} href="/returns" variant="outline">
          <ArrowLeft className="h-4 w-4" />
          Back to Returns
        </Button>
      }
    >
      {!saleReturn && !error && <LoadingState label="Loading return..." />}
      {error && <ErrorState onRetry={load} />}

      {saleReturn && (
        <div className="space-y-6">
          <Card>
            <CardBody>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <div>
                  <p className="text-xs font-medium uppercase tracking-wide text-[var(--color-text-muted)]">
                    Original sale
                  </p>
                  <p className="mt-1 text-sm font-medium text-[var(--color-text-primary)]">
                    <Link
                      href={`/sales/${saleReturn.sale.id}`}
                      className="text-[var(--color-brand-700)] hover:underline"
                    >
                      #{String(saleReturn.sale.saleNumber).padStart(6, "0")}
                    </Link>
                  </p>
                </div>
                <div>
                  <p className="text-xs font-medium uppercase tracking-wide text-[var(--color-text-muted)]">
                    Processed
                  </p>
                  <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
                    {formatDate(saleReturn.createdAt)}
                  </p>
                </div>
                <div>
                  <p className="text-xs font-medium uppercase tracking-wide text-[var(--color-text-muted)]">
                    Processed by
                  </p>
                  <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
                    {saleReturn.processedBy.name}
                  </p>
                </div>
                <div>
                  <p className="text-xs font-medium uppercase tracking-wide text-[var(--color-text-muted)]">
                    Refund
                  </p>
                  <p className="mt-1 flex items-center gap-2 text-sm font-medium text-[var(--color-text-primary)]">
                    {formatMoney(saleReturn.refundAmount)}
                    <Badge tone={saleReturn.refundMethod === "CASH" ? "success" : "info"}>
                      {saleReturn.refundMethod}
                    </Badge>
                  </p>
                </div>
              </div>
              {saleReturn.reason && (
                <div className="mt-4 border-t border-[var(--color-border)] pt-4">
                  <p className="text-xs font-medium uppercase tracking-wide text-[var(--color-text-muted)]">
                    Reason
                  </p>
                  <p className="mt-1 text-sm text-[var(--color-text-secondary)]">{saleReturn.reason}</p>
                </div>
              )}
            </CardBody>
          </Card>

          <Card>
            <CardHeader>
              <h2 className="text-sm font-semibold text-[var(--color-text-primary)]">Returned items</h2>
            </CardHeader>
            <CardBody>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-[var(--color-border)] text-left text-xs font-medium uppercase tracking-wide text-[var(--color-text-muted)]">
                      <th className="py-2.5 pr-4">Product</th>
                      <th className="py-2.5 pr-4">Qty</th>
                      <th className="py-2.5 pr-4">Restocked</th>
                      <th className="py-2.5 pr-4">Refund</th>
                    </tr>
                  </thead>
                  <tbody>
                    {saleReturn.items.map((item) => (
                      <tr key={item.id} className="border-b border-[var(--color-border)] last:border-0">
                        <td className="py-3 pr-4 font-medium text-[var(--color-text-primary)]">
                          {item.saleItem.productName}
                        </td>
                        <td className="py-3 pr-4 text-[var(--color-text-secondary)]">{item.quantity}</td>
                        <td className="py-3 pr-4">
                          <Badge tone={item.restocked ? "success" : "neutral"}>
                            {item.restocked ? "Yes" : "No"}
                          </Badge>
                        </td>
                        <td className="py-3 pr-4 font-medium text-[var(--color-text-primary)]">
                          {formatMoney(item.refundAmount)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr>
                      <td colSpan={3} className="py-3 pr-4 text-right text-sm font-semibold text-[var(--color-text-primary)]">
                        Total refund
                      </td>
                      <td className="py-3 pr-4 text-sm font-semibold text-[var(--color-text-primary)]">
                        {formatMoney(saleReturn.refundAmount)}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </CardBody>
          </Card>
        </div>
      )}
    </PageLayout>
  );
}
