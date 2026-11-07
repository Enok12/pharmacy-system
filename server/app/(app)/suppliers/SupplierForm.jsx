"use client";

import { useState } from "react";
import Button from "@/components/ui/Button";

const fieldClass =
  "h-10 w-full rounded-lg border border-[var(--color-border)] bg-white px-3 text-sm text-[var(--color-text-primary)] focus:border-[var(--color-brand-600)] focus:outline-none focus:ring-2 focus:ring-[var(--color-brand-600)]/20";
const labelClass = "mb-1.5 block text-sm font-medium text-[var(--color-text-primary)]";

/**
 * Create/edit form for a Supplier. Pass `supplier` for edit mode (patches
 * /api/v1/suppliers/:id), omit it for create mode.
 */
export default function SupplierForm({ supplier, onSaved, onCancel }) {
  const [form, setForm] = useState({
    name: supplier?.name || "",
    contactPerson: supplier?.contactPerson || "",
    phone: supplier?.phone || "",
    email: supplier?.email || "",
    address: supplier?.address || "",
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  function update(field, value) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setSubmitting(true);

    try {
      const url = supplier ? `/api/v1/suppliers/${supplier.id}` : "/api/v1/suppliers";
      const method = supplier ? "PATCH" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          contactPerson: form.contactPerson || null,
          phone: form.phone || null,
          address: form.address || null,
        }),
      });
      const json = await res.json();

      if (!json.success) {
        setError(json.message || "Could not save supplier");
        return;
      }

      onSaved(json.data.supplier);
    } catch {
      setError("Could not reach the server. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className={labelClass}>Name</label>
        <input
          type="text"
          required
          value={form.name}
          onChange={(e) => update("name", e.target.value)}
          className={fieldClass}
          placeholder="e.g. MedSupply Co"
        />
      </div>

      <div>
        <label className={labelClass}>Contact person</label>
        <input
          type="text"
          value={form.contactPerson}
          onChange={(e) => update("contactPerson", e.target.value)}
          className={fieldClass}
          placeholder="Optional"
        />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label className={labelClass}>Phone</label>
          <input
            type="text"
            value={form.phone}
            onChange={(e) => update("phone", e.target.value)}
            className={fieldClass}
            placeholder="Optional"
          />
        </div>
        <div>
          <label className={labelClass}>Email</label>
          <input
            type="email"
            value={form.email}
            onChange={(e) => update("email", e.target.value)}
            className={fieldClass}
            placeholder="Optional"
          />
        </div>
      </div>

      <div>
        <label className={labelClass}>Address</label>
        <textarea
          rows={2}
          value={form.address}
          onChange={(e) => update("address", e.target.value)}
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
          {submitting ? "Saving..." : supplier ? "Save changes" : "Add supplier"}
        </Button>
      </div>
    </form>
  );
}
