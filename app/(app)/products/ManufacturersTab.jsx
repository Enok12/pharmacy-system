"use client";

import { useEffect, useState, useCallback } from "react";
import { Factory, Pencil } from "lucide-react";
import Card, { CardBody } from "@/components/ui/Card";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import Modal from "@/components/feedback/Modal";
import ConfirmDialog from "@/components/feedback/ConfirmDialog";
import { TableSkeleton } from "@/components/feedback/LoadingState";
import ErrorState from "@/components/feedback/ErrorState";
import EmptyState from "@/components/feedback/EmptyState";
import { useToast } from "@/components/feedback/ToastProvider";
import ManufacturerForm from "./ManufacturerForm";

export default function ManufacturersTab({ canWrite, formOpen, onFormOpenChange }) {
  const { toast } = useToast();
  const [manufacturers, setManufacturers] = useState(null);
  const [error, setError] = useState(false);
  const [showInactive, setShowInactive] = useState(false);
  const [editing, setEditing] = useState(null);
  const [deactivating, setDeactivating] = useState(null);
  const [toggling, setToggling] = useState(false);

  const load = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (!showInactive) params.set("isActive", "true");
      const res = await fetch(`/api/v1/manufacturers?${params}`);
      const json = await res.json();
      if (!json.success) throw new Error(json.message);
      setError(false);
      setManufacturers(json.data.manufacturers);
    } catch {
      setError(true);
    }
  }, [showInactive]);

  useEffect(() => {
    load();
  }, [load]);

  function handleSaved() {
    toast({ tone: "success", title: editing ? "Manufacturer updated" : "Manufacturer created" });
    onFormOpenChange(false);
    setEditing(null);
    load();
  }

  async function handleToggleActive() {
    setToggling(true);
    try {
      const res = await fetch(`/api/v1/manufacturers/${deactivating.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: !deactivating.isActive }),
      });
      const json = await res.json();
      if (!json.success) {
        toast({ tone: "error", title: json.message || "Could not update manufacturer" });
        return;
      }
      toast({
        tone: "success",
        title: deactivating.isActive ? "Manufacturer deactivated" : "Manufacturer activated",
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
          Show inactive manufacturers
        </label>

        {manufacturers === null && !error && <TableSkeleton rows={4} columns={3} />}
        {error && <ErrorState onRetry={load} />}
        {manufacturers?.length === 0 && (
          <EmptyState
            icon={Factory}
            title="No manufacturers yet"
            message="Manufacturers are linked to products for sourcing and reporting."
            action={
              canWrite && <Button onClick={() => onFormOpenChange(true)}>Add Manufacturer</Button>
            }
          />
        )}
        {manufacturers && manufacturers.length > 0 && (
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
                {manufacturers.map((manufacturer) => (
                  <tr key={manufacturer.id} className="border-b border-[var(--color-border)] last:border-0">
                    <td className="py-3 pr-4 font-medium text-[var(--color-text-primary)]">
                      {manufacturer.name}
                    </td>
                    <td className="py-3 pr-4 text-[var(--color-text-secondary)]">
                      {manufacturer.description || "—"}
                    </td>
                    <td className="py-3 pr-4">
                      <Badge tone={manufacturer.isActive ? "success" : "neutral"}>
                        {manufacturer.isActive ? "Active" : "Inactive"}
                      </Badge>
                    </td>
                    {canWrite && (
                      <td className="py-3 pr-4 text-right">
                        <div className="flex justify-end gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setEditing(manufacturer)}
                            aria-label={`Edit ${manufacturer.name}`}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant={manufacturer.isActive ? "danger" : "outline"}
                            size="sm"
                            onClick={() => setDeactivating(manufacturer)}
                          >
                            {manufacturer.isActive ? "Deactivate" : "Activate"}
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
        title="Add Manufacturer"
        size="sm"
      >
        <ManufacturerForm onSaved={handleSaved} onCancel={() => onFormOpenChange(false)} />
      </Modal>

      <Modal isOpen={Boolean(editing)} onClose={() => setEditing(null)} title="Edit Manufacturer" size="sm">
        {editing && (
          <ManufacturerForm
            manufacturer={editing}
            onSaved={handleSaved}
            onCancel={() => setEditing(null)}
          />
        )}
      </Modal>

      <ConfirmDialog
        isOpen={Boolean(deactivating)}
        title={deactivating?.isActive ? "Deactivate this manufacturer?" : "Activate this manufacturer?"}
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
