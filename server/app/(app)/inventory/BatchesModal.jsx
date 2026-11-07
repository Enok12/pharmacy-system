"use client";

import { useEffect, useState } from "react";
import Modal from "@/components/feedback/Modal";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import LoadingState from "@/components/feedback/LoadingState";
import ErrorState from "@/components/feedback/ErrorState";
import EmptyState from "@/components/feedback/EmptyState";
import { useToast } from "@/components/feedback/ToastProvider";
import { Boxes } from "lucide-react";

const STATUS_BADGE = {
  EXPIRED: { tone: "danger", label: "Expired" },
  EXPIRING_SOON: { tone: "warning", label: "Expiring soon" },
  OK: { tone: "neutral", label: null },
};

const REASON_OPTIONS = [
  { value: "DAMAGED", label: "Damaged" },
  { value: "EXPIRED", label: "Expired" },
  { value: "LOST_STOLEN", label: "Lost / stolen" },
  { value: "COUNT_CORRECTION", label: "Count correction" },
  { value: "OTHER", label: "Other" },
];

const fieldClass =
  "h-10 w-full rounded-lg border border-[var(--color-border)] bg-white px-3 text-sm text-[var(--color-text-primary)] focus:border-[var(--color-brand-600)] focus:outline-none focus:ring-2 focus:ring-[var(--color-brand-600)]/20";
const labelClass = "mb-1.5 block text-sm font-medium text-[var(--color-text-primary)]";

function formatDate(value) {
  return new Date(value).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

/**
 * Inline form for correcting one batch's quantityRemaining outside the
 * normal stock-in/sell flow. Posts to /api/v1/stock-adjustments.
 */
function AdjustBatchForm({ batch, onSaved, onCancel }) {
  const [quantityChange, setQuantityChange] = useState("");
  const [reason, setReason] = useState(REASON_OPTIONS[0].value);
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");

    const parsed = Number(quantityChange);
    if (!Number.isInteger(parsed) || parsed === 0) {
      setError("Enter a non-zero whole number (negative to remove stock, positive to add).");
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/v1/stock-adjustments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ batchId: batch.id, quantityChange: parsed, reason, notes: notes || null }),
      });
      const json = await res.json();
      if (!json.success) {
        setError(json.message || "Could not record adjustment");
        return;
      }
      onSaved();
    } catch {
      setError("Could not reach the server. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="rounded-lg bg-[var(--color-surface-muted)] px-3 py-2 text-sm text-[var(--color-text-secondary)]">
        Batch <span className="font-medium text-[var(--color-text-primary)]">{batch.batchNumber}</span> —{" "}
        {batch.quantityRemaining} currently remaining
      </div>

      <div>
        <label className={labelClass}>Quantity change</label>
        <input
          type="number"
          required
          value={quantityChange}
          onChange={(e) => setQuantityChange(e.target.value)}
          className={fieldClass}
          placeholder="e.g. -5 or 10"
        />
        <p className="mt-1 text-xs text-[var(--color-text-muted)]">
          Use a negative number to remove stock, positive to add.
        </p>
      </div>

      <div>
        <label className={labelClass}>Reason</label>
        <select value={reason} onChange={(e) => setReason(e.target.value)} className={fieldClass}>
          {REASON_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className={labelClass}>Notes</label>
        <textarea
          rows={2}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
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
          {submitting ? "Saving..." : "Save adjustment"}
        </Button>
      </div>
    </form>
  );
}

/**
 * Shows a product's batches in FEFO order (soonest expiry first) — this
 * is the order a pharmacist should physically pick stock from. When
 * `canAdjust`, each row also gets an Adjust action for stock corrections.
 */
export default function BatchesModal({ productId, productName, isOpen, onClose, canAdjust }) {
  const { toast } = useToast();
  const [batches, setBatches] = useState(null);
  const [error, setError] = useState(false);
  const [retryKey, setRetryKey] = useState(0);
  const [adjustingBatch, setAdjustingBatch] = useState(null);

  useEffect(() => {
    if (!isOpen || !productId) return;
    setBatches(null);
    setError(false);

    fetch(`/api/v1/inventory/products/${productId}/batches`)
      .then((r) => r.json())
      .then((json) => {
        if (!json.success) throw new Error(json.message);
        setBatches(json.data.batches);
      })
      .catch(() => setError(true));
  }, [isOpen, productId, retryKey]);

  function handleAdjusted() {
    toast({ tone: "success", title: "Stock adjustment recorded" });
    setAdjustingBatch(null);
    setRetryKey((k) => k + 1);
  }

  return (
    <>
      <Modal
        isOpen={isOpen}
        onClose={onClose}
        title={productName ? `Batches — ${productName}` : "Batches"}
        size="lg"
      >
        {batches === null && !error && <LoadingState label="Loading batches..." />}
        {error && (
          <ErrorState
            message="We couldn't load batches for this product."
            onRetry={() => setRetryKey((k) => k + 1)}
          />
        )}
        {batches?.length === 0 && (
          <EmptyState icon={Boxes} title="No stock on hand" message="This product has no remaining batches." />
        )}
        {batches && batches.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[var(--color-border)] text-left text-xs font-medium uppercase tracking-wide text-[var(--color-text-muted)]">
                  <th className="py-2.5 pr-4">Batch #</th>
                  <th className="py-2.5 pr-4">Expiry</th>
                  <th className="py-2.5 pr-4">Qty remaining</th>
                  <th className="py-2.5 pr-4">Supplier</th>
                  {canAdjust && <th className="py-2.5 pr-4" />}
                </tr>
              </thead>
              <tbody>
                {batches.map((batch) => {
                  const badge = STATUS_BADGE[batch.status];
                  return (
                    <tr key={batch.id} className="border-b border-[var(--color-border)] last:border-0">
                      <td className="py-3 pr-4 font-medium text-[var(--color-text-primary)]">
                        {batch.batchNumber}
                      </td>
                      <td className="py-3 pr-4 text-[var(--color-text-secondary)]">
                        <div className="flex items-center gap-2">
                          {formatDate(batch.expiryDate)}
                          {badge.label && <Badge tone={badge.tone}>{badge.label}</Badge>}
                        </div>
                      </td>
                      <td className="py-3 pr-4 text-[var(--color-text-secondary)]">
                        {batch.quantityRemaining}
                      </td>
                      <td className="py-3 pr-4 text-[var(--color-text-secondary)]">
                        {batch.supplier.name}
                      </td>
                      {canAdjust && (
                        <td className="py-3 pr-4 text-right">
                          <Button variant="outline" size="sm" onClick={() => setAdjustingBatch(batch)}>
                            Adjust
                          </Button>
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Modal>

      <Modal
        isOpen={Boolean(adjustingBatch)}
        onClose={() => setAdjustingBatch(null)}
        title="Adjust batch quantity"
        size="md"
      >
        {adjustingBatch && (
          <AdjustBatchForm
            batch={adjustingBatch}
            onSaved={handleAdjusted}
            onCancel={() => setAdjustingBatch(null)}
          />
        )}
      </Modal>
    </>
  );
}
