"use client";

import { useEffect, useState } from "react";
import { Plus } from "lucide-react";
import Button from "@/components/ui/Button";
import Modal from "@/components/feedback/Modal";
import CategoryForm from "./CategoryForm";
import ManufacturerForm from "./ManufacturerForm";

const UNITS_OF_MEASURE = [
  "TABLET",
  "CAPSULE",
  "BOTTLE",
  "VIAL",
  "TUBE",
  "BOX",
  "STRIP",
  "ML",
  "MG",
  "G",
  "UNIT",
];

const fieldClass =
  "h-10 w-full rounded-lg border border-[var(--color-border)] bg-white px-3 text-sm text-[var(--color-text-primary)] focus:border-[var(--color-brand-600)] focus:outline-none focus:ring-2 focus:ring-[var(--color-brand-600)]/20";
const labelClass = "mb-1.5 block text-sm font-medium text-[var(--color-text-primary)]";

/**
 * Create/edit form for a Product. `categoryId`/`manufacturerId` are
 * dropdowns fetched on mount, each with a "+ New" quick-add so a pharmacist
 * adding a product for a category/manufacturer that doesn't exist yet
 * doesn't have to leave the form (see products/page.js design notes).
 */
export default function ProductForm({ product, onSaved, onCancel }) {
  const [categories, setCategories] = useState([]);
  const [manufacturers, setManufacturers] = useState([]);
  const [quickAdd, setQuickAdd] = useState(null); // "category" | "manufacturer" | null

  const [form, setForm] = useState({
    name: product?.name || "",
    genericName: product?.genericName || "",
    categoryId: product?.category?.id || "",
    manufacturerId: product?.manufacturer?.id || "",
    unitOfMeasure: product?.unitOfMeasure || "TABLET",
    barcode: product?.barcode || "",
    costPrice: product?.costPrice ?? "",
    sellingPrice: product?.sellingPrice ?? "",
    taxRate: product?.taxRate ?? 0,
    reorderLevel: product?.reorderLevel ?? 0,
    description: product?.description || "",
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState({});

  async function loadOptions() {
    const [categoriesRes, manufacturersRes] = await Promise.all([
      fetch("/api/v1/categories?isActive=true").then((r) => r.json()),
      fetch("/api/v1/manufacturers?isActive=true").then((r) => r.json()),
    ]);
    if (categoriesRes.success) setCategories(categoriesRes.data.categories);
    if (manufacturersRes.success) setManufacturers(manufacturersRes.data.manufacturers);
  }

  useEffect(() => {
    loadOptions();
  }, []);

  function update(field, value) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  function handleCategoryCreated(category) {
    setCategories((c) => [...c, category]);
    update("categoryId", category.id);
    setQuickAdd(null);
  }

  function handleManufacturerCreated(manufacturer) {
    setManufacturers((m) => [...m, manufacturer]);
    update("manufacturerId", manufacturer.id);
    setQuickAdd(null);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setFieldErrors({});
    setSubmitting(true);

    try {
      const url = product ? `/api/v1/products/${product.id}` : "/api/v1/products";
      const method = product ? "PATCH" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          genericName: form.genericName || null,
          barcode: form.barcode || null,
          description: form.description || null,
        }),
      });
      const json = await res.json();

      if (!json.success) {
        setError(json.message || "Could not save product");
        const byField = {};
        for (const e of json.errors || []) byField[e.field] = e.message;
        setFieldErrors(byField);
        return;
      }

      onSaved(json.data.product);
    } catch {
      setError("Could not reach the server. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className={labelClass}>Name</label>
            <input
              type="text"
              required
              value={form.name}
              onChange={(e) => update("name", e.target.value)}
              className={fieldClass}
              placeholder="e.g. Paracetamol 500mg"
            />
            {fieldErrors.name && <p className="mt-1 text-xs text-[var(--color-danger)]">{fieldErrors.name}</p>}
          </div>

          <div>
            <label className={labelClass}>Generic name</label>
            <input
              type="text"
              value={form.genericName}
              onChange={(e) => update("genericName", e.target.value)}
              className={fieldClass}
              placeholder="e.g. Paracetamol"
            />
          </div>

          <div>
            <label className={labelClass}>Category</label>
            <div className="flex gap-2">
              <select
                required
                value={form.categoryId}
                onChange={(e) => update("categoryId", e.target.value)}
                className={fieldClass}
              >
                <option value="" disabled>
                  Select a category
                </option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
              <Button type="button" variant="outline" size="md" onClick={() => setQuickAdd("category")}>
                <Plus className="h-4 w-4" />
              </Button>
            </div>
            {fieldErrors.categoryId && (
              <p className="mt-1 text-xs text-[var(--color-danger)]">{fieldErrors.categoryId}</p>
            )}
          </div>

          <div>
            <label className={labelClass}>Manufacturer</label>
            <div className="flex gap-2">
              <select
                required
                value={form.manufacturerId}
                onChange={(e) => update("manufacturerId", e.target.value)}
                className={fieldClass}
              >
                <option value="" disabled>
                  Select a manufacturer
                </option>
                {manufacturers.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name}
                  </option>
                ))}
              </select>
              <Button type="button" variant="outline" size="md" onClick={() => setQuickAdd("manufacturer")}>
                <Plus className="h-4 w-4" />
              </Button>
            </div>
            {fieldErrors.manufacturerId && (
              <p className="mt-1 text-xs text-[var(--color-danger)]">{fieldErrors.manufacturerId}</p>
            )}
          </div>

          <div>
            <label className={labelClass}>Unit of measure</label>
            <select
              value={form.unitOfMeasure}
              onChange={(e) => update("unitOfMeasure", e.target.value)}
              className={fieldClass}
            >
              {UNITS_OF_MEASURE.map((u) => (
                <option key={u} value={u}>
                  {u}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className={labelClass}>Barcode</label>
            <input
              type="text"
              value={form.barcode}
              onChange={(e) => update("barcode", e.target.value)}
              className={fieldClass}
              placeholder="Optional"
            />
            {fieldErrors.barcode && <p className="mt-1 text-xs text-[var(--color-danger)]">{fieldErrors.barcode}</p>}
          </div>

          <div>
            <label className={labelClass}>Cost price</label>
            <input
              type="number"
              step="0.01"
              min="0"
              required
              value={form.costPrice}
              onChange={(e) => update("costPrice", e.target.value)}
              className={fieldClass}
            />
            {fieldErrors.costPrice && (
              <p className="mt-1 text-xs text-[var(--color-danger)]">{fieldErrors.costPrice}</p>
            )}
          </div>

          <div>
            <label className={labelClass}>Selling price</label>
            <input
              type="number"
              step="0.01"
              min="0"
              required
              value={form.sellingPrice}
              onChange={(e) => update("sellingPrice", e.target.value)}
              className={fieldClass}
            />
            {fieldErrors.sellingPrice && (
              <p className="mt-1 text-xs text-[var(--color-danger)]">{fieldErrors.sellingPrice}</p>
            )}
          </div>

          <div>
            <label className={labelClass}>Tax rate (%)</label>
            <input
              type="number"
              step="0.01"
              min="0"
              max="100"
              value={form.taxRate}
              onChange={(e) => update("taxRate", e.target.value)}
              className={fieldClass}
            />
          </div>

          <div>
            <label className={labelClass}>Reorder level</label>
            <input
              type="number"
              step="1"
              min="0"
              value={form.reorderLevel}
              onChange={(e) => update("reorderLevel", e.target.value)}
              className={fieldClass}
            />
          </div>
        </div>

        <div>
          <label className={labelClass}>Description</label>
          <textarea
            rows={3}
            value={form.description}
            onChange={(e) => update("description", e.target.value)}
            className="w-full rounded-lg border border-[var(--color-border)] bg-white px-3 py-2 text-sm text-[var(--color-text-primary)] focus:border-[var(--color-brand-600)] focus:outline-none focus:ring-2 focus:ring-[var(--color-brand-600)]/20"
            placeholder="Optional"
          />
        </div>

        {error && (
          <p className="rounded-lg bg-[var(--color-danger-bg)] px-3 py-2 text-sm text-[var(--color-danger)]">
            {error}
          </p>
        )}

        <div className="flex items-center justify-end gap-2 pt-1">
          <Button type="button" variant="outline" onClick={onCancel} disabled={submitting}>
            Cancel
          </Button>
          <Button type="submit" disabled={submitting}>
            {submitting ? "Saving..." : product ? "Save changes" : "Add product"}
          </Button>
        </div>
      </form>

      <Modal isOpen={quickAdd === "category"} onClose={() => setQuickAdd(null)} title="Add Category" size="sm">
        <CategoryForm onSaved={handleCategoryCreated} onCancel={() => setQuickAdd(null)} />
      </Modal>

      <Modal
        isOpen={quickAdd === "manufacturer"}
        onClose={() => setQuickAdd(null)}
        title="Add Manufacturer"
        size="sm"
      >
        <ManufacturerForm onSaved={handleManufacturerCreated} onCancel={() => setQuickAdd(null)} />
      </Modal>
    </>
  );
}
