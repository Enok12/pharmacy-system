"use client";

import { useState } from "react";
import Modal from "@/components/feedback/Modal";
import Button from "@/components/ui/Button";
import { useToast } from "@/components/feedback/ToastProvider";

function formatMoney(value) {
  return new Intl.NumberFormat(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(
    value || 0
  );
}

/**
 * Payment method + (for cash) amount tendered, with live change
 * calculation. Stock-shortfall errors from checkout itself (the only
 * stock check left, now that there's no server-side cart to soft-guard
 * against) surface as a toast rather than a field error — there's no
 * single field to blame, and the cart (the caller's `items`) is left
 * exactly as it was so the cashier can adjust the quantity and retry.
 */
export default function CheckoutModal({ isOpen, onClose, items, total, onSuccess }) {
  const { toast } = useToast();
  const [paymentMethod, setPaymentMethod] = useState("CASH");
  const [amountTendered, setAmountTendered] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const tendered = Number(amountTendered) || 0;
  const change = tendered - total;
  const canConfirm = paymentMethod === "CARD" || (amountTendered !== "" && tendered >= total);

  function handleClose() {
    setPaymentMethod("CASH");
    setAmountTendered("");
    onClose();
  }

  async function handleConfirm() {
    setSubmitting(true);
    try {
      const res = await fetch("/api/v1/sales", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          paymentMethod,
          ...(paymentMethod === "CASH" ? { amountTendered: tendered } : {}),
          items: items.map((item) => ({ productId: item.productId, quantity: item.quantity })),
        }),
      });
      const json = await res.json();
      if (!json.success) {
        toast({ tone: "error", title: json.message || "Checkout failed", description: json.errors?.[0]?.message });
        return;
      }
      handleClose();
      onSuccess(json.data.sale);
    } catch {
      toast({ tone: "error", title: "Could not reach the server" });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title="Checkout" size="sm">
      <div className="space-y-4">
        <p className="flex items-baseline justify-between">
          <span className="text-sm text-[var(--color-text-secondary)]">Total due</span>
          <span className="text-2xl font-bold text-[var(--color-text-primary)]">{formatMoney(total)}</span>
        </p>

        <div>
          <p className="mb-1.5 text-sm font-medium text-[var(--color-text-primary)]">Payment method</p>
          <div className="flex gap-2">
            <Button
              type="button"
              variant={paymentMethod === "CASH" ? "primary" : "outline"}
              className="flex-1"
              onClick={() => setPaymentMethod("CASH")}
            >
              Cash
            </Button>
            <Button
              type="button"
              variant={paymentMethod === "CARD" ? "primary" : "outline"}
              className="flex-1"
              onClick={() => setPaymentMethod("CARD")}
            >
              Card
            </Button>
          </div>
        </div>

        {paymentMethod === "CASH" && (
          <div>
            <label htmlFor="amount-tendered" className="mb-1.5 block text-sm font-medium text-[var(--color-text-primary)]">
              Amount tendered
            </label>
            <input
              id="amount-tendered"
              type="number"
              min="0"
              step="0.01"
              autoFocus
              value={amountTendered}
              onChange={(e) => setAmountTendered(e.target.value)}
              className="h-10 w-full rounded-lg border border-[var(--color-border)] bg-white px-3 text-sm text-[var(--color-text-primary)] focus:border-[var(--color-brand-600)] focus:outline-none focus:ring-2 focus:ring-[var(--color-brand-600)]/20"
            />
            {amountTendered !== "" && (
              <p className="mt-1.5 text-sm text-[var(--color-text-secondary)]">
                Change due:{" "}
                <span className="font-semibold text-[var(--color-text-primary)]">
                  {formatMoney(Math.max(change, 0))}
                </span>
              </p>
            )}
          </div>
        )}

        <div className="flex items-center justify-end gap-2 pt-1">
          <Button type="button" variant="outline" onClick={handleClose} disabled={submitting}>
            Cancel
          </Button>
          <Button type="button" onClick={handleConfirm} disabled={!canConfirm || submitting}>
            {submitting ? "Processing..." : "Confirm payment"}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
