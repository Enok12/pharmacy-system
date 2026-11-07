"use client";

import { useState } from "react";
import clsx from "clsx";
import { Plus } from "lucide-react";
import PageLayout from "@/components/layout/PageLayout";
import Button from "@/components/ui/Button";
import ProductsTab from "./ProductsTab";
import CategoriesTab from "./CategoriesTab";
import ManufacturersTab from "./ManufacturersTab";

const TABS = [
  { key: "products", label: "Products", addLabel: "Add Product" },
  { key: "categories", label: "Categories", addLabel: "Add Category" },
  { key: "manufacturers", label: "Manufacturers", addLabel: "Add Manufacturer" },
];

/**
 * `/products` is one route with an in-page tab strip (Products / Categories
 * / Manufacturers) rather than three separate nav items — Sidebar.jsx's
 * NAV_ITEMS has exactly one entry for this domain and adding nav items is
 * out of scope for this phase. See the Phase 3 plan for the full rationale.
 */
export default function ProductsPageClient({ canWrite }) {
  const [activeTab, setActiveTab] = useState("products");
  const [formOpen, setFormOpen] = useState(false);

  const current = TABS.find((t) => t.key === activeTab);

  return (
    <PageLayout
      title="Products"
      description="Manage your product catalog, categories, and manufacturers."
      breadcrumbs={[{ label: "Dashboard", href: "/dashboard" }, { label: "Products" }]}
      actions={
        canWrite && (
          <Button onClick={() => setFormOpen(true)}>
            <Plus className="h-4 w-4" />
            {current.addLabel}
          </Button>
        )
      }
    >
      <div className="mb-6 flex gap-1 border-b border-[var(--color-border)]">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            type="button"
            onClick={() => {
              setActiveTab(tab.key);
              setFormOpen(false);
            }}
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

      {activeTab === "products" && (
        <ProductsTab canWrite={canWrite} formOpen={formOpen} onFormOpenChange={setFormOpen} />
      )}
      {activeTab === "categories" && (
        <CategoriesTab canWrite={canWrite} formOpen={formOpen} onFormOpenChange={setFormOpen} />
      )}
      {activeTab === "manufacturers" && (
        <ManufacturersTab canWrite={canWrite} formOpen={formOpen} onFormOpenChange={setFormOpen} />
      )}
    </PageLayout>
  );
}
