"use client";

import { useState, useEffect } from "react";
import Card, { CardBody } from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import LoadingState from "@/components/feedback/LoadingState";
import ErrorState from "@/components/feedback/ErrorState";
import { formatCurrency } from "@/lib/utils";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from "recharts";

export default function TopProductsTab() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [data, setData] = useState([]);

  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  async function loadData() {
    setLoading(true);
    setError(null);
    try {
      const query = new URLSearchParams();
      if (from) query.append("from", new Date(from).toISOString());
      if (to) query.append("to", new Date(to).toISOString());

      const res = await fetch(`/api/v1/reports/top-products?${query.toString()}`);
      if (!res.ok) throw new Error("Failed to load top products");

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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (loading && data.length === 0) return <LoadingState label="Loading top products..." />;
  if (error && data.length === 0) return <ErrorState message={error} onRetry={loadData} />;

  const chartData = data.map((d) => ({
    name: d.product.name,
    revenue: d.revenue,
    quantity: d.quantitySold,
  }));

  return (
    <div className="space-y-6">
      <Card>
        <CardBody className="p-4 flex flex-wrap items-end gap-4">
          <div>
            <label className="mb-1 block text-xs font-medium text-[var(--color-text-secondary)]">From</label>
            <input
              type="date"
              className="block w-full rounded-md border border-[var(--color-border)] px-3 py-1.5 text-sm"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-[var(--color-text-secondary)]">To</label>
            <input
              type="date"
              className="block w-full rounded-md border border-[var(--color-border)] px-3 py-1.5 text-sm"
              value={to}
              onChange={(e) => setTo(e.target.value)}
            />
          </div>
          <Button onClick={loadData}>Apply Filter</Button>
        </CardBody>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Table */}
        <Card>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-[var(--color-surface-muted)] text-[var(--color-text-secondary)]">
                <tr>
                  <th className="px-4 py-3 font-medium">Product</th>
                  <th className="px-4 py-3 font-medium text-right">Qty Sold</th>
                  <th className="px-4 py-3 font-medium text-right">Revenue</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--color-border)]">
                {data.map((row, i) => (
                  <tr key={row.product.id} className="hover:bg-[var(--color-surface-muted)]">
                    <td className="px-4 py-3 font-medium text-[var(--color-text-primary)]">
                      {i + 1}. {row.product.name}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums text-[var(--color-text-secondary)]">
                      {row.quantitySold}
                    </td>
                    <td className="px-4 py-3 text-right font-medium tabular-nums text-[var(--color-text-primary)]">
                      {formatCurrency(row.revenue)}
                    </td>
                  </tr>
                ))}
                {data.length === 0 && (
                  <tr>
                    <td colSpan={3} className="px-4 py-8 text-center text-[var(--color-text-muted)]">
                      No sales found for this period.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </Card>

        {/* Chart */}
        <Card>
          <CardBody className="p-4">
            <h3 className="text-sm font-semibold mb-4 text-[var(--color-text-primary)]">Revenue by Product</h3>
            <div className="h-72 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} layout="vertical" margin={{ top: 0, right: 0, left: 40, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="var(--color-border)" />
                  <XAxis 
                    type="number" 
                    tickFormatter={(val) => `$${val}`}
                    stroke="var(--color-text-muted)"
                    fontSize={12}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis 
                    type="category" 
                    dataKey="name" 
                    stroke="var(--color-text-muted)"
                    fontSize={12}
                    width={100}
                    axisLine={false}
                    tickLine={false}
                  />
                  <Tooltip 
                    formatter={(value) => formatCurrency(value)}
                    contentStyle={{ borderRadius: '8px', border: '1px solid var(--color-border)' }}
                  />
                  <Bar dataKey="revenue" radius={[0, 4, 4, 0]}>
                    {chartData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill="var(--color-brand-500)" />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardBody>
        </Card>
      </div>
    </div>
  );
}
