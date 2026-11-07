"use client";

import { useState } from "react";
import Button from "@/components/ui/Button";

/**
 * Create/edit form for a Category. Pass `category` for edit mode (patches
 * /api/v1/categories/:id), omit it for create mode (posts to
 * /api/v1/categories). Calls onSaved(category) so the caller can update its
 * own list/selection without a full refetch.
 */
export default function CategoryForm({ category, onSaved, onCancel }) {
  const [name, setName] = useState(category?.name || "");
  const [description, setDescription] = useState(category?.description || "");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setSubmitting(true);

    try {
      const url = category ? `/api/v1/categories/${category.id}` : "/api/v1/categories";
      const method = category ? "PATCH" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, description: description || null }),
      });
      const json = await res.json();

      if (!json.success) {
        setError(json.message || "Could not save category");
        return;
      }

      onSaved(json.data.category);
    } catch {
      setError("Could not reach the server. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label htmlFor="category-name" className="mb-1.5 block text-sm font-medium text-[var(--color-text-primary)]">
          Name
        </label>
        <input
          id="category-name"
          type="text"
          required
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="h-10 w-full rounded-lg border border-[var(--color-border)] bg-white px-3 text-sm text-[var(--color-text-primary)] focus:border-[var(--color-brand-600)] focus:outline-none focus:ring-2 focus:ring-[var(--color-brand-600)]/20"
          placeholder="e.g. Pain Relief"
        />
      </div>

      <div>
        <label htmlFor="category-description" className="mb-1.5 block text-sm font-medium text-[var(--color-text-primary)]">
          Description
        </label>
        <textarea
          id="category-description"
          rows={3}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
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
          {submitting ? "Saving..." : category ? "Save changes" : "Add category"}
        </Button>
      </div>
    </form>
  );
}
