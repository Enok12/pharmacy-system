"use client";

import { useEffect, useState, useCallback } from "react";
import { Plus, Truck, Pencil } from "lucide-react";
import PageLayout from "@/components/layout/PageLayout";
import Card, { CardBody } from "@/components/ui/Card";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import Modal from "@/components/feedback/Modal";
import ConfirmDialog from "@/components/feedback/ConfirmDialog";
import { TableSkeleton } from "@/components/feedback/LoadingState";
import ErrorState from "@/components/feedback/ErrorState";
import EmptyState from "@/components/feedback/EmptyState";
import { useToast } from "@/components/feedback/ToastProvider";
import SupplierForm from "./SupplierForm";

export default function SuppliersClient() {
  const { toast } = useToast();
  const [suppliers, setSuppliers] = useState(null);
  const [error, setError] = useState(false);
  const [showInactive, setShowInactive] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [deactivating, setDeactivating] = useState(null);
  const [toggling, setToggling] = useState(false);

  const load = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (!showInactive) params.set("isActive", "true");
      const res = await fetch(`/api/v1/suppliers?${params}`);
      const json = await res.json();
      if (!json.success) throw new Error(json.message);
      setError(false);
      setSuppliers(json.data.suppliers);
    } catch {
      setError(true);
    }
  }, [showInactive]);

  useEffect(() => {
    load();
  }, [load]);

  function handleSaved() {
    toast({ tone: "success", title: editing ? "Supplier updated" : "Supplier created" });
    setFormOpen(false);
    setEditing(null);
    load();
  }

  async function handleToggleActive() {
    setToggling(true);
    try {
      const res = await fetch(`/api/v1/suppliers/${deactivating.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: !deactivating.isActive }),
      });
      const json = await res.json();
      if (!json.success) {
        toast({ tone: "error", title: json.message || "Could not update supplier" });
        return;
      }
      toast({
        tone: "success",
        title: deactivating.isActive ? "Supplier deactivated" : "Supplier activated",
      });
      setDeactivating(null);
      load();
    } finally {
      setToggling(false);
    }
  }

  return (
    <PageLayout
      title="Suppliers"
      description="Manage the suppliers you receive stock from."
      breadcrumbs={[{ label: "Dashboard", href: "/dashboard" }, { label: "Suppliers" }]}
      actions={
        <Button onClick={() => setFormOpen(true)}>
          <Plus className="h-4 w-4" />
          Add Supplier
        </Button>
      }
    >
      <Card>
        <CardBody>
          <label className="mb-4 flex items-center gap-2 text-sm text-[var(--color-text-secondary)]">
            <input
              type="checkbox"
              checked={showInactive}
              onChange={(e) => setShowInactive(e.target.checked)}
              className="h-4 w-4 rounded border-[var(--color-border)]"
            />
            Show inactive suppliers
          </label>

          {suppliers === null && !error && <TableSkeleton rows={4} columns={5} />}
          {error && <ErrorState onRetry={load} />}
          {suppliers?.length === 0 && (
            <EmptyState
              icon={Truck}
              title="No suppliers yet"
              message="Add a supplier before recording a stock-in delivery."
              action={<Button onClick={() => setFormOpen(true)}>Add Supplier</Button>}
            />
          )}
          {suppliers && suppliers.length > 0 && (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[var(--color-border)] text-left text-xs font-medium uppercase tracking-wide text-[var(--color-text-muted)]">
                    <th className="py-2.5 pr-4">Name</th>
                    <th className="py-2.5 pr-4">Contact</th>
                    <th className="py-2.5 pr-4">Phone</th>
                    <th className="py-2.5 pr-4">Email</th>
                    <th className="py-2.5 pr-4">Status</th>
                    <th className="py-2.5 pr-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {suppliers.map((supplier) => (
                    <tr key={supplier.id} className="border-b border-[var(--color-border)] last:border-0">
                      <td className="py-3 pr-4 font-medium text-[var(--color-text-primary)]">
                        {supplier.name}
                      </td>
                      <td className="py-3 pr-4 text-[var(--color-text-secondary)]">
                        {supplier.contactPerson || "—"}
                      </td>
                      <td className="py-3 pr-4 text-[var(--color-text-secondary)]">
                        {supplier.phone || "—"}
                      </td>
                      <td className="py-3 pr-4 text-[var(--color-text-secondary)]">
                        {supplier.email || "—"}
                      </td>
                      <td className="py-3 pr-4">
                        <Badge tone={supplier.isActive ? "success" : "neutral"}>
                          {supplier.isActive ? "Active" : "Inactive"}
                        </Badge>
                      </td>
                      <td className="py-3 pr-4 text-right">
                        <div className="flex justify-end gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setEditing(supplier)}
                            aria-label={`Edit ${supplier.name}`}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant={supplier.isActive ? "danger" : "outline"}
                            size="sm"
                            onClick={() => setDeactivating(supplier)}
                          >
                            {supplier.isActive ? "Deactivate" : "Activate"}
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardBody>
      </Card>

      <Modal isOpen={formOpen && !editing} onClose={() => setFormOpen(false)} title="Add Supplier" size="md">
        <SupplierForm onSaved={handleSaved} onCancel={() => setFormOpen(false)} />
      </Modal>

      <Modal isOpen={Boolean(editing)} onClose={() => setEditing(null)} title="Edit Supplier" size="md">
        {editing && (
          <SupplierForm supplier={editing} onSaved={handleSaved} onCancel={() => setEditing(null)} />
        )}
      </Modal>

      <ConfirmDialog
        isOpen={Boolean(deactivating)}
        title={deactivating?.isActive ? "Deactivate this supplier?" : "Activate this supplier?"}
        description={
          deactivating?.isActive
            ? "It will no longer be selectable when recording new stock-in deliveries."
            : "It will become selectable for new stock-in deliveries again."
        }
        confirmLabel={deactivating?.isActive ? "Deactivate" : "Activate"}
        variant={deactivating?.isActive ? "danger" : "primary"}
        isLoading={toggling}
        onConfirm={handleToggleActive}
        onCancel={() => setDeactivating(null)}
      />
    </PageLayout>
  );
}
