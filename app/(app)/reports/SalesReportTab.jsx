"use client";

import { useState, useEffect } from "react";
import Card, { CardBody } from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import LoadingState from "@/components/feedback/LoadingState";
import ErrorState from "@/components/feedback/ErrorState";
import { formatCurrency, formatDate } from "@/lib/utils";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";

export default function SalesReportTab() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [data, setData] = useState(null);
  
  // By default, backend returns last 30 days
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  async function loadData() {
    setLoading(true);
    setError(null);
    try {
      const query = new URLSearchParams();
      if (from) query.append("from", new Date(from).toISOString());
      if (to) query.append("to", new Date(to).toISOString());

      const res = await fetch(`/api/v1/reports/sales?${query.toString()}`);
      if (!res.ok) throw new Error("Failed to load sales report");

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

  if (loading && !data) return <LoadingState label="Loading sales report..." />;
  if (error && !data) return <ErrorState message={error} onRetry={loadData} />;

  const { totals, daily } = data;

  return (
    <div className="space-y-6">
      {/* Filters */}
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

      {/* Totals */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard title="Revenue" value={formatCurrency(totals.revenue)} subtitle={`${totals.saleCount} sales`} />
        <StatCard title="Cost of Goods" value={formatCurrency(totals.cost)} />
        <StatCard title="Gross Profit" value={formatCurrency(totals.profit)} tone="success" />
        <StatCard title="Total Tax" value={formatCurrency(totals.tax)} />
      </div>

      {/* Chart */}
      <Card>
        <CardBody className="p-4">
          <h3 className="text-sm font-semibold mb-4 text-[var(--color-text-primary)]">Daily Revenue & Profit</h3>
          <div className="h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={daily} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--color-border)" />
                <XAxis 
                  dataKey="date" 
                  tickFormatter={(val) => formatDate(val)}
                  stroke="var(--color-text-muted)"
                  fontSize={12}
                  tickLine={false}
                  axisLine={false}
                />
                <YAxis 
                  tickFormatter={(val) => `$${val}`}
                  stroke="var(--color-text-muted)"
                  fontSize={12}
                  tickLine={false}
                  axisLine={false}
                />
                <Tooltip 
                  formatter={(value) => formatCurrency(value)}
                  labelFormatter={(label) => formatDate(label)}
                  contentStyle={{ borderRadius: '8px', border: '1px solid var(--color-border)' }}
                />
                <Legend iconType="circle" wrapperStyle={{ fontSize: '12px' }} />
                <Bar dataKey="revenue" name="Revenue" fill="var(--color-brand-500)" radius={[4, 4, 0, 0]} />
                <Bar dataKey="profit" name="Profit" fill="#10b981" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardBody>
      </Card>
    </div>
  );
}

function StatCard({ title, value, subtitle, tone = "default" }) {
  return (
    <Card>
      <CardBody className="p-5">
        <p className="text-sm font-medium text-[var(--color-text-secondary)]">{title}</p>
        <p className={`text-2xl font-bold tracking-tight mt-1 ${tone === "success" ? "text-[var(--color-success)]" : "text-[var(--color-text-primary)]"}`}>
          {value}
        </p>
        {subtitle && <p className="text-xs text-[var(--color-text-muted)] mt-1">{subtitle}</p>}
      </CardBody>
    </Card>
  );
}
