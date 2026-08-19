"use client";

import { useEffect, useState, useCallback } from "react";
import { Tags, Pencil } from "lucide-react";
import Card, { CardBody } from "@/components/ui/Card";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import Modal from "@/components/feedback/Modal";
import ConfirmDialog from "@/components/feedback/ConfirmDialog";
import LoadingState, { TableSkeleton } from "@/components/feedback/LoadingState";
import ErrorState from "@/components/feedback/ErrorState";
import EmptyState from "@/components/feedback/EmptyState";
import { useToast } from "@/components/feedback/ToastProvider";
import CategoryForm from "./CategoryForm";

export default function CategoriesTab({ canWrite, formOpen, onFormOpenChange }) {
  const { toast } = useToast();
  const [categories, setCategories] = useState(null);
  const [error, setError] = useState(false);
  const [showInactive, setShowInactive] = useState(false);
  const [editing, setEditing] = useState(null); // null = create mode when formOpen is true
  const [deactivating, setDeactivating] = useState(null);
  const [toggling, setToggling] = useState(false);

  const load = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (!showInactive) params.set("isActive", "true");
      const res = await fetch(`/api/v1/categories?${params}`);
      const json = await res.json();
      if (!json.success) throw new Error(json.message);
      setError(false);
      setCategories(json.data.categories);
    } catch {
      setError(true);
    }
  }, [showInactive]);

  useEffect(() => {
    load();
  }, [load]);

  function handleSaved(category) {
    toast({ tone: "success", title: editing ? "Category updated" : "Category created" });
    onFormOpenChange(false);
    setEditing(null);
    load();
  }

  async function handleToggleActive() {
    setToggling(true);
    try {
      const res = await fetch(`/api/v1/categories/${deactivating.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: !deactivating.isActive }),
      });
      const json = await res.json();
      if (!json.success) {
        toast({ tone: "error", title: json.message || "Could not update category" });
        return;
      }
      toast({
        tone: "success",
        title: deactivating.isActive ? "Category deactivated" : "Category activated",
      });
      setDeactivating(null);
      load();
    } finally {
      setToggling(false);
    }
  }

  return (
    <Card>
      <CardBody>
        <label className="mb-4 flex items-center gap-2 text-sm text-[var(--color-text-secondary)]">
          <input
            type="checkbox"
            checked={showInactive}
            onChange={(e) => setShowInactive(e.target.checked)}
            className="h-4 w-4 rounded border-[var(--color-border)]"
          />
          Show inactive categories
        </label>

        {categories === null && !error && <TableSkeleton rows={4} columns={3} />}
        {error && <ErrorState onRetry={load} />}
        {categories?.length === 0 && (
          <EmptyState
            icon={Tags}
            title="No categories yet"
            message="Categories group products for browsing and reporting."
            action={
              canWrite && <Button onClick={() => onFormOpenChange(true)}>Add Category</Button>
            }
          />
        )}
        {categories && categories.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[var(--color-border)] text-left text-xs font-medium uppercase tracking-wide text-[var(--color-text-muted)]">
                  <th className="py-2.5 pr-4">Name</th>
                  <th className="py-2.5 pr-4">Description</th>
                  <th className="py-2.5 pr-4">Status</th>
                  {canWrite && <th className="py-2.5 pr-4 text-right">Actions</th>}
                </tr>
              </thead>
              <tbody>
                {categories.map((category) => (
                  <tr key={category.id} className="border-b border-[var(--color-border)] last:border-0">
                    <td className="py-3 pr-4 font-medium text-[var(--color-text-primary)]">
                      {category.name}
                    </td>
                    <td className="py-3 pr-4 text-[var(--color-text-secondary)]">
                      {category.description || "—"}
                    </td>
                    <td className="py-3 pr-4">
                      <Badge tone={category.isActive ? "success" : "neutral"}>
                        {category.isActive ? "Active" : "Inactive"}
                      </Badge>
                    </td>
                    {canWrite && (
                      <td className="py-3 pr-4 text-right">
                        <div className="flex justify-end gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setEditing(category)}
                            aria-label={`Edit ${category.name}`}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant={category.isActive ? "danger" : "outline"}
                            size="sm"
                            onClick={() => setDeactivating(category)}
                          >
                            {category.isActive ? "Deactivate" : "Activate"}
                          </Button>
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardBody>

      <Modal
        isOpen={formOpen && !editing}
        onClose={() => onFormOpenChange(false)}
        title="Add Category"
        size="sm"
      >
        <CategoryForm onSaved={handleSaved} onCancel={() => onFormOpenChange(false)} />
      </Modal>

      <Modal isOpen={Boolean(editing)} onClose={() => setEditing(null)} title="Edit Category" size="sm">
        {editing && (
          <CategoryForm
            category={editing}
            onSaved={handleSaved}
            onCancel={() => setEditing(null)}
          />
        )}
      </Modal>

      <ConfirmDialog
        isOpen={Boolean(deactivating)}
        title={deactivating?.isActive ? "Deactivate this category?" : "Activate this category?"}
        description={
          deactivating?.isActive
            ? "It will no longer be selectable for new products."
            : "It will become selectable for new products again."
        }
        confirmLabel={deactivating?.isActive ? "Deactivate" : "Activate"}
        variant={deactivating?.isActive ? "danger" : "primary"}
        isLoading={toggling}
        onConfirm={handleToggleActive}
        onCancel={() => setDeactivating(null)}
      />
    </Card>
  );
}
