"use client";

import { useState, useEffect } from "react";
import Card, { CardBody } from "@/components/ui/Card";
import LoadingState from "@/components/feedback/LoadingState";
import ErrorState from "@/components/feedback/ErrorState";
import { formatCurrency } from "@/lib/utils";

export default function ValuationTab() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [data, setData] = useState(null);

  async function loadData() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/v1/reports/inventory-valuation`);
      if (!res.ok) throw new Error("Failed to load valuation");

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

  if (loading && !data) return <LoadingState label="Loading valuation..." />;
  if (error && !data) return <ErrorState message={error} onRetry={loadData} />;

  const { products, totals } = data;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <StatCard title="Total Cost Value" value={formatCurrency(totals.costValue)} subtitle="Based on received cost per batch" />
        <StatCard title="Total Retail Value" value={formatCurrency(totals.retailValue)} subtitle="Based on current selling price" />
      </div>

      <Card>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-[var(--color-surface-muted)] text-[var(--color-text-secondary)]">
              <tr>
                <th className="px-4 py-3 font-medium">Product</th>
                <th className="px-4 py-3 font-medium">Category</th>
                <th className="px-4 py-3 font-medium text-right">Qty on Hand</th>
                <th className="px-4 py-3 font-medium text-right">Cost Value</th>
                <th className="px-4 py-3 font-medium text-right">Retail Value</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--color-border)]">
              {products.map((row) => (
                <tr key={row.product.id} className="hover:bg-[var(--color-surface-muted)]">
                  <td className="px-4 py-3 font-medium text-[var(--color-text-primary)]">
                    {row.product.name}
                  </td>
                  <td className="px-4 py-3 text-[var(--color-text-secondary)]">
                    {row.category}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums text-[var(--color-text-secondary)]">
                    {row.quantityRemaining}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums text-[var(--color-text-primary)]">
                    {formatCurrency(row.costValue)}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums text-[var(--color-text-primary)]">
                    {formatCurrency(row.retailValue)}
                  </td>
                </tr>
              ))}
              {products.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-[var(--color-text-muted)]">
                    No active inventory found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

function StatCard({ title, value, subtitle }) {
  return (
    <Card>
      <CardBody className="p-5">
        <p className="text-sm font-medium text-[var(--color-text-secondary)]">{title}</p>
        <p className="text-2xl font-bold tracking-tight mt-1 text-[var(--color-text-primary)]">
          {value}
        </p>
        {subtitle && <p className="text-xs text-[var(--color-text-muted)] mt-1">{subtitle}</p>}
      </CardBody>
    </Card>
  );
}
