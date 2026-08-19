"use client";

import { useState } from "react";
import clsx from "clsx";
import PageLayout from "@/components/layout/PageLayout";
import SalesReportTab from "./SalesReportTab";
import TopProductsTab from "./TopProductsTab";
import ValuationTab from "./ValuationTab";

const TABS = [
  { key: "sales", label: "Sales Report" },
  { key: "top-products", label: "Top Products" },
  { key: "valuation", label: "Inventory Valuation" },
];

export default function ReportsClient() {
  const [activeTab, setActiveTab] = useState("sales");

  return (
    <PageLayout
      title="Reports"
      description="View sales trends, top performing products, and inventory valuation."
      breadcrumbs={[{ label: "Dashboard", href: "/dashboard" }, { label: "Reports" }]}
    >
      <div className="mb-6 flex gap-1 border-b border-[var(--color-border)]">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            type="button"
            onClick={() => setActiveTab(tab.key)}
            className={clsx(
              "border-b-2 px-4 py-2.5 text-sm font-medium transition-colors",
              activeTab === tab.key
                ? "border-[var(--color-brand-700)] text-[var(--color-brand-700)]"
                : "border-transparent text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]"
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === "sales" && <SalesReportTab />}
      {activeTab === "top-products" && <TopProductsTab />}
      {activeTab === "valuation" && <ValuationTab />}
    </PageLayout>
  );
}
