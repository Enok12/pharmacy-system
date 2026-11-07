"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import PageLayout from "@/components/layout/PageLayout";
import Card, { CardBody, CardHeader } from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import LoadingState from "@/components/feedback/LoadingState";
import ErrorState from "@/components/feedback/ErrorState";

function formatDate(value) {
  if (!value) return "—";
  return new Date(value).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function formatMoney(value) {
  return new Intl.NumberFormat(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(
    value
  );
}

export default function StockInDetailClient({ id }) {
  const [stockIn, setStockIn] = useState(null);
  const [error, setError] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/v1/stock-ins/${id}`);
      const json = await res.json();
      if (!json.success) throw new Error(json.message);
      setError(false);
      setStockIn(json.data.stockIn);
    } catch {
      setError(true);
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  const total = stockIn
    ? stockIn.batches.reduce((sum, b) => sum + b.quantityReceived * b.costPricePerUnit, 0)
    : 0;

  return (
    <PageLayout
      title="Stock-In Receipt"
      breadcrumbs={[
        { label: "Dashboard", href: "/dashboard" },
        { label: "Stock In", href: "/stock-in" },
        { label: "Receipt" },
      ]}
      actions={
        <Button as={Link} href="/stock-in" variant="outline">
          <ArrowLeft className="h-4 w-4" />
          Back to Stock In
        </Button>
      }
    >
      {!stockIn && !error && <LoadingState label="Loading receipt..." />}
      {error && <ErrorState onRetry={load} />}

      {stockIn && (
        <div className="space-y-6">
          <Card>
            <CardBody>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <div>
                  <p className="text-xs font-medium uppercase tracking-wide text-[var(--color-text-muted)]">
                    Supplier
                  </p>
                  <p className="mt-1 text-sm font-medium text-[var(--color-text-primary)]">
                    {stockIn.supplier.name}
                  </p>
                </div>
                <div>
                  <p className="text-xs font-medium uppercase tracking-wide text-[var(--color-text-muted)]">
                    Reference
                  </p>
                  <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
                    {stockIn.referenceNumber || "—"}
                  </p>
                </div>
                <div>
                  <p className="text-xs font-medium uppercase tracking-wide text-[var(--color-text-muted)]">
                    Received
                  </p>
                  <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
                    {formatDate(stockIn.receivedAt)}
                  </p>
                </div>
                <div>
                  <p className="text-xs font-medium uppercase tracking-wide text-[var(--color-text-muted)]">
                    Received by
                  </p>
                  <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
                    {stockIn.receivedBy.name}
                  </p>
                </div>
              </div>
              {stockIn.notes && (
                <div className="mt-4 border-t border-[var(--color-border)] pt-4">
                  <p className="text-xs font-medium uppercase tracking-wide text-[var(--color-text-muted)]">
                    Notes
                  </p>
                  <p className="mt-1 text-sm text-[var(--color-text-secondary)]">{stockIn.notes}</p>
                </div>
              )}
            </CardBody>
          </Card>

          <Card>
            <CardHeader>
              <h2 className="text-sm font-semibold text-[var(--color-text-primary)]">Items received</h2>
            </CardHeader>
            <CardBody>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-[var(--color-border)] text-left text-xs font-medium uppercase tracking-wide text-[var(--color-text-muted)]">
                      <th className="py-2.5 pr-4">Product</th>
                      <th className="py-2.5 pr-4">Batch #</th>
                      <th className="py-2.5 pr-4">Expiry</th>
                      <th className="py-2.5 pr-4">Qty</th>
                      <th className="py-2.5 pr-4">Cost/unit</th>
                      <th className="py-2.5 pr-4">Subtotal</th>
                    </tr>
                  </thead>
                  <tbody>
                    {stockIn.batches.map((batch) => (
                      <tr key={batch.id} className="border-b border-[var(--color-border)] last:border-0">
                        <td className="py-3 pr-4 font-medium text-[var(--color-text-primary)]">
                          {batch.product.name}
                        </td>
                        <td className="py-3 pr-4 text-[var(--color-text-secondary)]">
                          {batch.batchNumber}
                        </td>
                        <td className="py-3 pr-4 text-[var(--color-text-secondary)]">
                          {formatDate(batch.expiryDate)}
                        </td>
                        <td className="py-3 pr-4 text-[var(--color-text-secondary)]">
                          {batch.quantityReceived}
                        </td>
                        <td className="py-3 pr-4 text-[var(--color-text-secondary)]">
                          {formatMoney(batch.costPricePerUnit)}
                        </td>
                        <td className="py-3 pr-4 font-medium text-[var(--color-text-primary)]">
                          {formatMoney(batch.quantityReceived * batch.costPricePerUnit)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr>
                      <td colSpan={5} className="py-3 pr-4 text-right text-sm font-semibold text-[var(--color-text-primary)]">
                        Grand total
                      </td>
                      <td className="py-3 pr-4 text-sm font-semibold text-[var(--color-text-primary)]">
                        {formatMoney(total)}
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
