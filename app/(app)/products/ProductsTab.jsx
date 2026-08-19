"use client";

import { useEffect, useState, useCallback } from "react";
import { Package, Pencil, ChevronLeft, ChevronRight } from "lucide-react";
import Card, { CardBody } from "@/components/ui/Card";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import Modal from "@/components/feedback/Modal";
import ConfirmDialog from "@/components/feedback/ConfirmDialog";
import { TableSkeleton } from "@/components/feedback/LoadingState";
import ErrorState from "@/components/feedback/ErrorState";
import EmptyState from "@/components/feedback/EmptyState";
import { useToast } from "@/components/feedback/ToastProvider";
import ProductForm from "./ProductForm";

const PAGE_SIZE = 20;

function formatMoney(value) {
  return new Intl.NumberFormat(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(
    value
  );
}

export default function ProductsTab({ canWrite, formOpen, onFormOpenChange }) {
  const { toast } = useToast();
  const [result, setResult] = useState(null); // { products, total, page, pageSize }
  const [error, setError] = useState(false);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [showInactive, setShowInactive] = useState(false);
  const [editing, setEditing] = useState(null);
  const [deactivating, setDeactivating] = useState(null);
  const [toggling, setToggling] = useState(false);

  const load = useCallback(async () => {
    try {
      const params = new URLSearchParams({ page: String(page), pageSize: String(PAGE_SIZE) });
      if (search) params.set("search", search);
      if (!showInactive) params.set("isActive", "true");
      const res = await fetch(`/api/v1/products?${params}`);
      const json = await res.json();
      if (!json.success) throw new Error(json.message);
      setError(false);
      setResult(json.data);
    } catch {
      setError(true);
    }
  }, [search, page, showInactive]);

  useEffect(() => {
    load();
  }, [load]);

  function handleSaved() {
    toast({ tone: "success", title: editing ? "Product updated" : "Product created" });
    onFormOpenChange(false);
    setEditing(null);
    load();
  }

  async function handleToggleActive() {
    setToggling(true);
    try {
      const res = await fetch(`/api/v1/products/${deactivating.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: !deactivating.isActive }),
      });
      const json = await res.json();
      if (!json.success) {
        toast({ tone: "error", title: json.message || "Could not update product" });
        return;
      }
      toast({
        tone: "success",
        title: deactivating.isActive ? "Product deactivated" : "Product activated",
      });
      setDeactivating(null);
      load();
    } finally {
      setToggling(false);
    }
  }

  const totalPages = result ? Math.max(1, Math.ceil(result.total / result.pageSize)) : 1;

  return (
    <Card>
      <CardBody>
        <div className="mb-4 flex flex-wrap items-center gap-3">
          <input
            type="text"
            value={search}
            onChange={(e) => {
              setPage(1);
              setSearch(e.target.value);
            }}
            placeholder="Search by name, generic name, or barcode..."
            className="h-10 w-full max-w-sm rounded-lg border border-[var(--color-border)] bg-white px-3 text-sm text-[var(--color-text-primary)] focus:border-[var(--color-brand-600)] focus:outline-none focus:ring-2 focus:ring-[var(--color-brand-600)]/20"
          />
          <label className="flex items-center gap-2 text-sm text-[var(--color-text-secondary)]">
            <input
              type="checkbox"
              checked={showInactive}
              onChange={(e) => {
                setPage(1);
                setShowInactive(e.target.checked);
              }}
              className="h-4 w-4 rounded border-[var(--color-border)]"
            />
            Show inactive products
          </label>
        </div>

        {result === null && !error && <TableSkeleton rows={6} columns={6} />}
        {error && <ErrorState onRetry={load} />}
        {result?.products.length === 0 && (
          <EmptyState
            icon={Package}
            title="No products yet"
            message="Products will appear here once you add them to the catalog."
            action={canWrite && <Button onClick={() => onFormOpenChange(true)}>Add Product</Button>}
          />
        )}
        {result && result.products.length > 0 && (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[var(--color-border)] text-left text-xs font-medium uppercase tracking-wide text-[var(--color-text-muted)]">
                    <th className="py-2.5 pr-4">Name</th>
                    <th className="py-2.5 pr-4">Category</th>
                    <th className="py-2.5 pr-4">Manufacturer</th>
                    <th className="py-2.5 pr-4">Unit</th>
                    <th className="py-2.5 pr-4">Price</th>
                    <th className="py-2.5 pr-4">Status</th>
                    {canWrite && <th className="py-2.5 pr-4 text-right">Actions</th>}
                  </tr>
                </thead>
                <tbody>
                  {result.products.map((product) => (
                    <tr key={product.id} className="border-b border-[var(--color-border)] last:border-0">
                      <td className="py-3 pr-4">
                        <p className="font-medium text-[var(--color-text-primary)]">{product.name}</p>
                        {product.genericName && (
                          <p className="text-xs text-[var(--color-text-muted)]">{product.genericName}</p>
                        )}
                      </td>
                      <td className="py-3 pr-4 text-[var(--color-text-secondary)]">
                        {product.category.name}
                      </td>
                      <td className="py-3 pr-4 text-[var(--color-text-secondary)]">
                        {product.manufacturer.name}
                      </td>
                      <td className="py-3 pr-4 text-[var(--color-text-secondary)]">
                        {product.unitOfMeasure}
                      </td>
                      <td className="py-3 pr-4 text-[var(--color-text-secondary)]">
                        {formatMoney(product.sellingPrice)}
                      </td>
                      <td className="py-3 pr-4">
                        <Badge tone={product.isActive ? "success" : "neutral"}>
                          {product.isActive ? "Active" : "Inactive"}
                        </Badge>
                      </td>
                      {canWrite && (
                        <td className="py-3 pr-4 text-right">
                          <div className="flex justify-end gap-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setEditing(product)}
                              aria-label={`Edit ${product.name}`}
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button
                              variant={product.isActive ? "danger" : "outline"}
                              size="sm"
                              onClick={() => setDeactivating(product)}
                            >
                              {product.isActive ? "Deactivate" : "Activate"}
                            </Button>
                          </div>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {totalPages > 1 && (
              <div className="mt-4 flex items-center justify-between text-sm text-[var(--color-text-secondary)]">
                <span>
                  Page {result.page} of {totalPages} ({result.total} products)
                </span>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={page <= 1}
                    onClick={() => setPage((p) => p - 1)}
                  >
                    <ChevronLeft className="h-4 w-4" />
                    Previous
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={page >= totalPages}
                    onClick={() => setPage((p) => p + 1)}
                  >
                    Next
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}
          </>
        )}
      </CardBody>

      <Modal
        isOpen={formOpen && !editing}
        onClose={() => onFormOpenChange(false)}
        title="Add Product"
        size="lg"
      >
        <ProductForm onSaved={handleSaved} onCancel={() => onFormOpenChange(false)} />
      </Modal>

      <Modal isOpen={Boolean(editing)} onClose={() => setEditing(null)} title="Edit Product" size="lg">
        {editing && (
          <ProductForm product={editing} onSaved={handleSaved} onCancel={() => setEditing(null)} />
        )}
      </Modal>

      <ConfirmDialog
        isOpen={Boolean(deactivating)}
        title={deactivating?.isActive ? "Deactivate this product?" : "Activate this product?"}
        description={
          deactivating?.isActive
            ? "It will no longer appear in POS search or new sales."
            : "It will become available in POS search and new sales again."
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
