"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2 } from "lucide-react";
import PageLayout from "@/components/layout/PageLayout";
import Card, { CardBody, CardHeader } from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import Modal from "@/components/feedback/Modal";
import { useToast } from "@/components/feedback/ToastProvider";
import SupplierForm from "../../suppliers/SupplierForm";

const fieldClass =
  "h-10 w-full rounded-lg border border-[var(--color-border)] bg-white px-3 text-sm text-[var(--color-text-primary)] focus:border-[var(--color-brand-600)] focus:outline-none focus:ring-2 focus:ring-[var(--color-brand-600)]/20";
const labelClass = "mb-1.5 block text-sm font-medium text-[var(--color-text-primary)]";

function emptyItem() {
  return {
    productId: "",
    batchNumber: "",
    expiryDate: "",
    manufacturingDate: "",
    quantityReceived: "",
    costPricePerUnit: "",
  };
}

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function formatMoney(value) {
  return new Intl.NumberFormat(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(
    value || 0
  );
}

export default function StockInForm() {
  const router = useRouter();
  const { toast } = useToast();

  const [suppliers, setSuppliers] = useState([]);
  const [products, setProducts] = useState([]);
  const [quickAddSupplier, setQuickAddSupplier] = useState(false);

  const [supplierId, setSupplierId] = useState("");
  const [referenceNumber, setReferenceNumber] = useState("");
  const [receivedAt, setReceivedAt] = useState(todayIso());
  const [notes, setNotes] = useState("");
  const [items, setItems] = useState([emptyItem()]);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState({});

  async function loadOptions() {
    const [suppliersRes, productsRes] = await Promise.all([
      fetch("/api/v1/suppliers?isActive=true").then((r) => r.json()),
      fetch("/api/v1/products?isActive=true&pageSize=100").then((r) => r.json()),
    ]);
    if (suppliersRes.success) setSuppliers(suppliersRes.data.suppliers);
    if (productsRes.success) setProducts(productsRes.data.products);
  }

  useEffect(() => {
    loadOptions();
  }, []);

  function handleSupplierCreated(supplier) {
    setSuppliers((s) => [...s, supplier]);
    setSupplierId(supplier.id);
    setQuickAddSupplier(false);
  }

  function updateItem(index, field, value) {
    setItems((current) =>
      current.map((item, i) => (i === index ? { ...item, [field]: value } : item))
    );
  }

  function addItem() {
    setItems((current) => [...current, emptyItem()]);
  }

  function removeItem(index) {
    setItems((current) => current.filter((_, i) => i !== index));
  }

  const total = items.reduce(
    (sum, item) => sum + (Number(item.quantityReceived) || 0) * (Number(item.costPricePerUnit) || 0),
    0
  );

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setFieldErrors({});
    setSubmitting(true);

    try {
      const res = await fetch("/api/v1/stock-ins", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          supplierId,
          referenceNumber: referenceNumber || null,
          receivedAt,
          notes: notes || null,
          items: items.map((item) => ({
            ...item,
            manufacturingDate: item.manufacturingDate || null,
          })),
        }),
      });
      const json = await res.json();

      if (!json.success) {
        setError(json.message || "Could not record stock-in");
        const byField = {};
        for (const e of json.errors || []) byField[e.field] = e.message;
        setFieldErrors(byField);
        return;
      }

      toast({ tone: "success", title: "Stock-in recorded" });
      router.push(`/stock-in/${json.data.stockIn.id}`);
    } catch {
      setError("Could not reach the server. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <PageLayout
      title="Record Stock-In"
      description="Log a delivery received from a supplier."
      breadcrumbs={[
        { label: "Dashboard", href: "/dashboard" },
        { label: "Stock In", href: "/stock-in" },
        { label: "Record Stock-In" },
      ]}
    >
      <form onSubmit={handleSubmit} className="space-y-6">
        <Card>
          <CardHeader>
            <h2 className="text-sm font-semibold text-[var(--color-text-primary)]">Delivery details</h2>
          </CardHeader>
          <CardBody>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className={labelClass}>Supplier</label>
                <div className="flex gap-2">
                  <select
                    required
                    value={supplierId}
                    onChange={(e) => setSupplierId(e.target.value)}
                    className={fieldClass}
                  >
                    <option value="" disabled>
                      Select a supplier
                    </option>
                    {suppliers.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                  </select>
                  <Button type="button" variant="outline" onClick={() => setQuickAddSupplier(true)}>
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
                {fieldErrors.supplierId && (
                  <p className="mt-1 text-xs text-[var(--color-danger)]">{fieldErrors.supplierId}</p>
                )}
              </div>

              <div>
                <label className={labelClass}>Reference number</label>
                <input
                  type="text"
                  value={referenceNumber}
                  onChange={(e) => setReferenceNumber(e.target.value)}
                  className={fieldClass}
                  placeholder="Supplier invoice / delivery note #"
                />
              </div>

              <div>
                <label className={labelClass}>Received date</label>
                <input
                  type="date"
                  required
                  value={receivedAt}
                  onChange={(e) => setReceivedAt(e.target.value)}
                  className={fieldClass}
                />
              </div>
            </div>

            <div className="mt-4">
              <label className={labelClass}>Notes</label>
              <textarea
                rows={2}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="w-full rounded-lg border border-[var(--color-border)] bg-white px-3 py-2 text-sm text-[var(--color-text-primary)] focus:border-[var(--color-brand-600)] focus:outline-none focus:ring-2 focus:ring-[var(--color-brand-600)]/20"
                placeholder="Optional"
              />
            </div>
          </CardBody>
        </Card>

        <Card>
          <CardHeader>
            <h2 className="text-sm font-semibold text-[var(--color-text-primary)]">Products received</h2>
          </CardHeader>
          <CardBody>
            {fieldErrors.items && (
              <p className="mb-4 rounded-lg bg-[var(--color-danger-bg)] px-3 py-2 text-sm text-[var(--color-danger)]">
                {fieldErrors.items}
              </p>
            )}

            <div className="space-y-4">
              {items.map((item, index) => (
                <div
                  key={index}
                  className="rounded-xl border border-[var(--color-border)] p-4"
                >
                  <div className="mb-3 flex items-center justify-between">
                    <p className="text-sm font-medium text-[var(--color-text-primary)]">
                      Item {index + 1}
                    </p>
                    {items.length > 1 && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => removeItem(index)}
                        aria-label={`Remove item ${index + 1}`}
                      >
                        <Trash2 className="h-4 w-4 text-[var(--color-danger)]" />
                      </Button>
                    )}
                  </div>

                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    <div>
                      <label className={labelClass}>Product</label>
                      <select
                        required
                        value={item.productId}
                        onChange={(e) => updateItem(index, "productId", e.target.value)}
                        className={fieldClass}
                      >
                        <option value="" disabled>
                          Select a product
                        </option>
                        {products.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.name}
                          </option>
                        ))}
                      </select>
                      {fieldErrors[`items[${index}].productId`] && (
                        <p className="mt-1 text-xs text-[var(--color-danger)]">
                          {fieldErrors[`items[${index}].productId`]}
                        </p>
                      )}
                    </div>

                    <div>
                      <label className={labelClass}>Batch number</label>
                      <input
                        type="text"
                        required
                        value={item.batchNumber}
                        onChange={(e) => updateItem(index, "batchNumber", e.target.value)}
                        className={fieldClass}
                      />
                    </div>

                    <div>
                      <label className={labelClass}>Expiry date</label>
                      <input
                        type="date"
                        required
                        value={item.expiryDate}
                        onChange={(e) => updateItem(index, "expiryDate", e.target.value)}
                        className={fieldClass}
                      />
                    </div>

                    <div>
                      <label className={labelClass}>Manufacturing date</label>
                      <input
                        type="date"
                        value={item.manufacturingDate}
                        onChange={(e) => updateItem(index, "manufacturingDate", e.target.value)}
                        className={fieldClass}
                      />
                    </div>

                    <div>
                      <label className={labelClass}>Quantity received</label>
                      <input
                        type="number"
                        min="1"
                        step="1"
                        required
                        value={item.quantityReceived}
                        onChange={(e) => updateItem(index, "quantityReceived", e.target.value)}
                        className={fieldClass}
                      />
                    </div>

                    <div>
                      <label className={labelClass}>Cost price per unit</label>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        required
                        value={item.costPricePerUnit}
                        onChange={(e) => updateItem(index, "costPricePerUnit", e.target.value)}
                        className={fieldClass}
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <Button type="button" variant="outline" className="mt-4" onClick={addItem}>
              <Plus className="h-4 w-4" />
              Add another product
            </Button>

            <div className="mt-6 flex items-center justify-end gap-2 border-t border-[var(--color-border)] pt-4">
              <p className="text-sm text-[var(--color-text-secondary)]">
                Total: <span className="font-semibold text-[var(--color-text-primary)]">{formatMoney(total)}</span>
              </p>
            </div>
          </CardBody>
        </Card>

        {error && (
          <p className="rounded-lg bg-[var(--color-danger-bg)] px-3 py-2 text-sm text-[var(--color-danger)]">
            {error}
          </p>
        )}

        <div className="flex items-center justify-end gap-2">
          <Button type="button" variant="outline" onClick={() => router.push("/stock-in")} disabled={submitting}>
            Cancel
          </Button>
          <Button type="submit" disabled={submitting}>
            {submitting ? "Saving..." : "Record Stock-In"}
          </Button>
        </div>
      </form>

      <Modal isOpen={quickAddSupplier} onClose={() => setQuickAddSupplier(false)} title="Add Supplier" size="md">
        <SupplierForm onSaved={handleSupplierCreated} onCancel={() => setQuickAddSupplier(false)} />
      </Modal>
    </PageLayout>
  );
}
