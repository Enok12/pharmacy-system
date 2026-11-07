"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Search } from "lucide-react";
import PageLayout from "@/components/layout/PageLayout";
import Card, { CardBody, CardHeader } from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import { useToast } from "@/components/feedback/ToastProvider";

const fieldClass =
  "h-10 w-full rounded-lg border border-[var(--color-border)] bg-white px-3 text-sm text-[var(--color-text-primary)] focus:border-[var(--color-brand-600)] focus:outline-none focus:ring-2 focus:ring-[var(--color-brand-600)]/20";
const labelClass = "mb-1.5 block text-sm font-medium text-[var(--color-text-primary)]";

function formatMoney(value) {
  return new Intl.NumberFormat(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(
    value || 0
  );
}

function lineRefund(item, quantity) {
  return quantity * item.unitPrice * (1 + item.taxRate / 100);
}

export default function ReturnForm() {
  const router = useRouter();
  const { toast } = useToast();

  const [saleNumberInput, setSaleNumberInput] = useState("");
  const [looking, setLooking] = useState(false);
  const [lookupError, setLookupError] = useState("");
  const [sale, setSale] = useState(null);

  // Keyed by saleItemId: { quantity: string, restock: boolean }
  const [lines, setLines] = useState({});
  const [refundMethod, setRefundMethod] = useState("CASH");
  const [reason, setReason] = useState("");

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState({});

  async function handleLookup(e) {
    e.preventDefault();
    setLookupError("");
    setSale(null);
    setLines({});

    const saleNumber = Number(saleNumberInput);
    if (!Number.isInteger(saleNumber) || saleNumber <= 0) {
      setLookupError("Enter a valid sale number");
      return;
    }

    setLooking(true);
    try {
      const listRes = await fetch(`/api/v1/sales?saleNumber=${saleNumber}&pageSize=1`);
      const listJson = await listRes.json();
      if (!listJson.success || listJson.data.sales.length === 0) {
        setLookupError(`No sale found with number #${saleNumber}`);
        return;
      }

      const saleId = listJson.data.sales[0].id;
      const detailRes = await fetch(`/api/v1/sales/${saleId}/returnable`);
      const detailJson = await detailRes.json();
      if (!detailJson.success) {
        setLookupError(detailJson.message || "Could not load sale details");
        return;
      }

      setSale(detailJson.data.sale);
      setRefundMethod(detailJson.data.sale.paymentMethod);
      const initialLines = {};
      for (const item of detailJson.data.sale.items) {
        initialLines[item.id] = { quantity: "", restock: true };
      }
      setLines(initialLines);
    } catch {
      setLookupError("Could not reach the server. Please try again.");
    } finally {
      setLooking(false);
    }
  }

  function updateLine(itemId, field, value) {
    setLines((current) => ({ ...current, [itemId]: { ...current[itemId], [field]: value } }));
  }

  const selectedLines = sale
    ? sale.items
        .map((item) => ({ item, quantity: Number(lines[item.id]?.quantity) || 0, restock: lines[item.id]?.restock }))
        .filter((line) => line.quantity > 0)
    : [];

  const total = selectedLines.reduce((sum, line) => sum + lineRefund(line.item, line.quantity), 0);

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setFieldErrors({});

    if (selectedLines.length === 0) {
      setError("Enter a quantity to return for at least one item");
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/v1/sale-returns", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          saleId: sale.id,
          reason: reason || null,
          refundMethod,
          items: selectedLines.map((line) => ({
            saleItemId: line.item.id,
            quantity: line.quantity,
            restock: Boolean(line.restock),
          })),
        }),
      });
      const json = await res.json();

      if (!json.success) {
        setError(json.message || "Could not process return");
        const byField = {};
        for (const e of json.errors || []) byField[e.field] = e.message;
        setFieldErrors(byField);
        return;
      }

      toast({ tone: "success", title: "Return processed" });
      router.push(`/returns/${json.data.saleReturn.id}`);
    } catch {
      setError("Could not reach the server. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <PageLayout
      title="Process Return"
      description="Look up a sale and return part or all of it."
      breadcrumbs={[
        { label: "Dashboard", href: "/dashboard" },
        { label: "Returns", href: "/returns" },
        { label: "Process Return" },
      ]}
    >
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <h2 className="text-sm font-semibold text-[var(--color-text-primary)]">Find sale</h2>
          </CardHeader>
          <CardBody>
            <form onSubmit={handleLookup} className="flex items-end gap-3">
              <div className="max-w-xs flex-1">
                <label className={labelClass}>Sale number</label>
                <input
                  type="number"
                  min="1"
                  step="1"
                  value={saleNumberInput}
                  onChange={(e) => setSaleNumberInput(e.target.value)}
                  className={fieldClass}
                  placeholder="e.g. 123"
                />
              </div>
              <Button type="submit" disabled={looking}>
                <Search className="h-4 w-4" />
                {looking ? "Looking up..." : "Look up"}
              </Button>
            </form>
            {lookupError && (
              <p className="mt-3 rounded-lg bg-[var(--color-danger-bg)] px-3 py-2 text-sm text-[var(--color-danger)]">
                {lookupError}
              </p>
            )}
          </CardBody>
        </Card>

        {sale && (
          <form onSubmit={handleSubmit} className="space-y-6">
            <Card>
              <CardHeader>
                <h2 className="text-sm font-semibold text-[var(--color-text-primary)]">
                  Sale #{String(sale.saleNumber).padStart(6, "0")} — {sale.cashier.name}
                </h2>
              </CardHeader>
              <CardBody>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-[var(--color-border)] text-left text-xs font-medium uppercase tracking-wide text-[var(--color-text-muted)]">
                        <th className="py-2.5 pr-4">Product</th>
                        <th className="py-2.5 pr-4">Purchased</th>
                        <th className="py-2.5 pr-4">Already returned</th>
                        <th className="py-2.5 pr-4">Returnable</th>
                        <th className="py-2.5 pr-4">Return qty</th>
                        <th className="py-2.5 pr-4">Restock</th>
                        <th className="py-2.5 pr-4">Refund</th>
                      </tr>
                    </thead>
                    <tbody>
                      {sale.items.map((item) => {
                        const line = lines[item.id] || { quantity: "", restock: true };
                        const quantity = Number(line.quantity) || 0;
                        return (
                          <tr key={item.id} className="border-b border-[var(--color-border)] last:border-0">
                            <td className="py-3 pr-4 font-medium text-[var(--color-text-primary)]">
                              {item.product.name}
                            </td>
                            <td className="py-3 pr-4 text-[var(--color-text-secondary)]">{item.quantity}</td>
                            <td className="py-3 pr-4 text-[var(--color-text-secondary)]">
                              {item.returnedQuantity}
                            </td>
                            <td className="py-3 pr-4 text-[var(--color-text-secondary)]">
                              {item.returnableQuantity}
                            </td>
                            <td className="py-3 pr-4">
                              <input
                                type="number"
                                min="0"
                                max={item.returnableQuantity}
                                step="1"
                                disabled={item.returnableQuantity === 0}
                                value={line.quantity}
                                onChange={(e) => updateLine(item.id, "quantity", e.target.value)}
                                className="h-9 w-20 rounded-lg border border-[var(--color-border)] bg-white px-2 text-sm focus:border-[var(--color-brand-600)] focus:outline-none focus:ring-2 focus:ring-[var(--color-brand-600)]/20"
                              />
                            </td>
                            <td className="py-3 pr-4">
                              <input
                                type="checkbox"
                                checked={Boolean(line.restock)}
                                disabled={item.returnableQuantity === 0}
                                onChange={(e) => updateLine(item.id, "restock", e.target.checked)}
                                className="h-4 w-4 rounded border-[var(--color-border)]"
                              />
                            </td>
                            <td className="py-3 pr-4 text-[var(--color-text-secondary)]">
                              {quantity > 0 ? formatMoney(lineRefund(item, quantity)) : "—"}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                {fieldErrors.items && (
                  <p className="mt-3 rounded-lg bg-[var(--color-danger-bg)] px-3 py-2 text-sm text-[var(--color-danger)]">
                    {fieldErrors.items}
                  </p>
                )}
              </CardBody>
            </Card>

            <Card>
              <CardHeader>
                <h2 className="text-sm font-semibold text-[var(--color-text-primary)]">Refund details</h2>
              </CardHeader>
              <CardBody>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div>
                    <label className={labelClass}>Refund method</label>
                    <select
                      value={refundMethod}
                      onChange={(e) => setRefundMethod(e.target.value)}
                      className={fieldClass}
                    >
                      <option value="CASH">Cash</option>
                      <option value="CARD">Card</option>
                    </select>
                  </div>
                  <div>
                    <label className={labelClass}>Reason</label>
                    <input
                      type="text"
                      value={reason}
                      onChange={(e) => setReason(e.target.value)}
                      className={fieldClass}
                      placeholder="Optional"
                    />
                  </div>
                </div>

                <div className="mt-6 flex items-center justify-end gap-4 border-t border-[var(--color-border)] pt-4">
                  <p className="text-sm text-[var(--color-text-secondary)]">
                    Refund total:{" "}
                    <span className="text-base font-semibold text-[var(--color-text-primary)]">
                      {formatMoney(total)}
                    </span>
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
              <Button type="button" variant="outline" onClick={() => router.push("/returns")} disabled={submitting}>
                Cancel
              </Button>
              <Button type="submit" disabled={submitting || selectedLines.length === 0}>
                {submitting ? "Processing..." : "Process Return"}
              </Button>
            </div>
          </form>
        )}
      </div>
    </PageLayout>
  );
}
