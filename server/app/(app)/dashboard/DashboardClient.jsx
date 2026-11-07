"use client";

import { useState, useEffect } from "react";
import PageLayout from "@/components/layout/PageLayout";
import Card, { CardBody, CardHeader } from "@/components/ui/Card";
import Badge from "@/components/ui/Badge";
import LoadingState from "@/components/feedback/LoadingState";
import ErrorState from "@/components/feedback/ErrorState";
import { formatCurrency, formatDate } from "@/lib/utils";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { Package, AlertTriangle, Clock, TrendingUp, DollarSign, Wallet } from "lucide-react";
import Link from "next/link";

export default function DashboardClient({ role }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [data, setData] = useState({ stats: null, trend: null, alerts: null });

  useEffect(() => {
    async function loadDashboard() {
      try {
        const [statsRes, trendRes, alertsRes] = await Promise.all([
          fetch("/api/v1/dashboard/stats"),
          role !== "CASHIER" ? fetch("/api/v1/dashboard/sales-trend") : Promise.resolve({ ok: true, json: () => ({ data: [] }) }),
          fetch("/api/v1/dashboard/alerts"),
        ]);

        if (!statsRes.ok || (role !== "CASHIER" && !trendRes.ok) || !alertsRes.ok) {
          throw new Error("Failed to load dashboard data");
        }

        const [statsBody, trendBody, alertsBody] = await Promise.all([
          statsRes.json(),
          trendRes.json(),
          alertsRes.json(),
        ]);

        setData({
          stats: statsBody.data,
          trend: trendBody.data,
          alerts: alertsBody.data,
        });
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }
    loadDashboard();
  }, [role]);

  if (loading) return <PageLayout title="Dashboard"><LoadingState label="Loading dashboard..." /></PageLayout>;
  if (error) return <PageLayout title="Dashboard"><ErrorState message={error} onRetry={() => window.location.reload()} /></PageLayout>;

  const { stats, trend, alerts } = data;
  const isCashier = role === "CASHIER";

  // Shared alert counts
  const totalAlerts = (stats.lowStockCount || 0) + (stats.outOfStockCount || 0) + (stats.expiringSoonCount || 0) + (stats.expiredCount || 0);

  return (
    <PageLayout title="Dashboard">
      {/* Top Stat Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4 mb-6">
        {isCashier ? (
          <>
            <StatCard
              title="My Sales Today"
              value={formatCurrency(stats.mySalesToday?.total || 0)}
              subtitle={`${stats.mySalesToday?.count || 0} transactions`}
              icon={DollarSign}
            />
            <StatCard
              title="Active Alerts"
              value={totalAlerts.toString()}
              subtitle="Stock and expiry warnings"
              icon={AlertTriangle}
              tone={totalAlerts > 0 ? "warning" : "success"}
            />
          </>
        ) : (
          <>
            <StatCard
              title="Today's Sales"
              value={formatCurrency(stats.todaysSales?.total || 0)}
              subtitle={`${stats.todaysSales?.count || 0} transactions`}
              icon={DollarSign}
            />
            <StatCard
              title="Month Revenue"
              value={formatCurrency(stats.monthRevenue || 0)}
              subtitle="Current month to date"
              icon={TrendingUp}
            />
            <StatCard
              title="Inventory Value"
              value={formatCurrency(stats.inventoryValue || 0)}
              subtitle="Total cost value on hand"
              icon={Wallet}
            />
            <StatCard
              title="Active Alerts"
              value={totalAlerts.toString()}
              subtitle="Stock and expiry warnings"
              icon={AlertTriangle}
              tone={totalAlerts > 0 ? "warning" : "success"}
            />
          </>
        )}
      </div>

      {/* Charts (Admin/Pharmacist Only) */}
      {!isCashier && (
        <Card className="mb-6">
          <CardHeader>
            <h3 className="text-base font-semibold text-[var(--color-text-primary)]">14-Day Sales Trend</h3>
          </CardHeader>
          <CardBody>
            <div className="h-72 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={trend} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--color-border)" />
                  <XAxis 
                    dataKey="date" 
                    tickFormatter={(val) => new Date(val).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
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
                    formatter={(value) => [formatCurrency(value), "Revenue"]}
                    labelFormatter={(label) => new Date(label).toLocaleDateString()}
                    contentStyle={{ borderRadius: '8px', border: '1px solid var(--color-border)', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                  />
                  <Line 
                    type="monotone" 
                    dataKey="revenue" 
                    stroke="var(--color-brand-600)" 
                    strokeWidth={2}
                    dot={{ r: 3, fill: "var(--color-brand-600)" }}
                    activeDot={{ r: 5 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </CardBody>
        </Card>
      )}

      {/* Alerts Feed */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Low Stock Alerts */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Package className="h-5 w-5 text-[var(--color-warning)]" />
              <h3 className="text-base font-semibold text-[var(--color-text-primary)]">Low Stock Alerts</h3>
            </div>
          </CardHeader>
          <div className="divide-y divide-[var(--color-border)]">
            {alerts.lowStock?.length === 0 ? (
              <div className="p-4 text-sm text-[var(--color-text-muted)] text-center">No low stock items.</div>
            ) : (
              alerts.lowStock?.map((item) => (
                <div key={item.id} className="flex items-center justify-between p-4">
                  <div>
                    <p className="text-sm font-medium text-[var(--color-text-primary)]">{item.name}</p>
                    <p className="text-xs text-[var(--color-text-secondary)]">Reorder level: {item.reorderLevel}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <Badge tone={item.stockStatus === "OUT" ? "danger" : "warning"}>
                      {item.stockStatus === "OUT" ? "Out of stock" : "Low stock"}
                    </Badge>
                    <span className="text-sm font-semibold tabular-nums">{item.totalRemaining}</span>
                  </div>
                </div>
              ))
            )}
          </div>
          <div className="p-3 bg-[var(--color-surface-muted)] border-t border-[var(--color-border)] text-center">
            <Link href="/inventory?stockStatus=LOW" className="text-sm font-medium text-[var(--color-brand-600)] hover:underline">
              View all inventory
            </Link>
          </div>
        </Card>

        {/* Expiring Soon Alerts */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Clock className="h-5 w-5 text-[var(--color-danger)]" />
              <h3 className="text-base font-semibold text-[var(--color-text-primary)]">Expiring Soon</h3>
            </div>
          </CardHeader>
          <div className="divide-y divide-[var(--color-border)]">
            {alerts.expiringSoon?.length === 0 ? (
              <div className="p-4 text-sm text-[var(--color-text-muted)] text-center">No batches expiring soon.</div>
            ) : (
              alerts.expiringSoon?.map((batch) => (
                <div key={batch.id} className="flex items-center justify-between p-4">
                  <div>
                    <p className="text-sm font-medium text-[var(--color-text-primary)]">{batch.product.name}</p>
                    <p className="text-xs text-[var(--color-text-secondary)]">Batch: {batch.batchNumber}</p>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <Badge tone={new Date(batch.expiryDate) < new Date() ? "danger" : "warning"}>
                      {new Date(batch.expiryDate) < new Date() ? "Expired" : "Expiring"}
                    </Badge>
                    <span className="text-xs font-medium text-[var(--color-text-secondary)]">
                      {formatDate(batch.expiryDate)}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
          <div className="p-3 bg-[var(--color-surface-muted)] border-t border-[var(--color-border)] text-center">
            <Link href="/inventory" className="text-sm font-medium text-[var(--color-brand-600)] hover:underline">
              Manage batches
            </Link>
          </div>
        </Card>
      </div>
    </PageLayout>
  );
}

function StatCard({ title, value, subtitle, icon: Icon, tone = "default" }) {
  const iconColors = {
    default: "text-[var(--color-brand-600)] bg-[var(--color-surface-muted)]",
    warning: "text-[var(--color-warning)] bg-amber-100",
    success: "text-[var(--color-success)] bg-green-100",
    danger: "text-[var(--color-danger)] bg-red-100",
  };

  return (
    <Card>
      <CardBody className="p-5 flex items-center gap-4">
        <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl ${iconColors[tone]}`}>
          <Icon className="h-6 w-6" />
        </div>
        <div>
          <p className="text-sm font-medium text-[var(--color-text-secondary)]">{title}</p>
          <p className="text-2xl font-bold tracking-tight text-[var(--color-text-primary)]">{value}</p>
          {subtitle && <p className="text-xs text-[var(--color-text-muted)] mt-1">{subtitle}</p>}
        </div>
      </CardBody>
    </Card>
  );
}
