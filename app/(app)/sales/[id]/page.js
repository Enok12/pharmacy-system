"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Printer } from "lucide-react";
import PageLayout from "@/components/layout/PageLayout";
import Card, { CardBody } from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import LoadingState from "@/components/feedback/LoadingState";
import ErrorState from "@/components/feedback/ErrorState";

function formatDate(value) {
  return new Date(value).toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatMoney(value) {
  return new Intl.NumberFormat(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(
    value
  );
}

/**
 * Same view used both right after checkout and when reprinting from
 * history — one place to keep the receipt layout in sync. Fetches
 * client-side like every other detail page in this app (the API stays
 * the single source of truth, even for this Next.js frontend itself).
 * A 404 here covers a Cashier trying to view someone else's sale.
 */
export default function ReceiptPage() {
  const { id } = useParams();
  const [sale, setSale] = useState(null);
  const [error, setError] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/v1/sales/${id}`);
      const json = await res.json();
      if (!json.success) throw new Error(json.message);
      setError(false);
      setSale(json.data.sale);
    } catch {
      setError(true);
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <PageLayout
      title="Receipt"
      breadcrumbs={[
        { label: "Dashboard", href: "/dashboard" },
        { label: "Sales", href: "/sales" },
        { label: "Receipt" },
      ]}
      actions={
        <div className="flex gap-2">
          <Button as={Link} href="/sales" variant="outline">
            <ArrowLeft className="h-4 w-4" />
            Back to Sales
          </Button>
          {sale && (
            <Button onClick={() => window.print()}>
              <Printer className="h-4 w-4" />
              Print
            </Button>
          )}
        </div>
      }
    >
      {!sale && !error && <LoadingState label="Loading receipt..." />}
      {error && <ErrorState onRetry={load} />}

      {sale && (
        <Card>
          <CardBody>
            <div className="mx-auto w-full max-w-[320px] font-mono text-sm text-[var(--color-text-primary)]">
              <div className="text-center">
                <p className="text-base font-bold tracking-tight">MedCare Pharmacy</p>
                <p className="text-xs text-[var(--color-text-muted)]">Inventory &amp; POS</p>
              </div>

              <div className="my-3 border-t border-dashed border-[var(--color-border)]" />

              <div className="space-y-0.5 text-xs">
                <p>Receipt #{String(sale.saleNumber).padStart(6, "0")}</p>
                <p>{formatDate(sale.createdAt)}</p>
                <p>Cashier: {sale.cashier.name}</p>
              </div>

              <div className="my-3 border-t border-dashed border-[var(--color-border)]" />

              <table className="w-full text-xs">
                <tbody>
                  {sale.items.map((item) => (
                    <tr key={item.id}>
                      <td className="py-1 pr-2 align-top">
                        {item.product.name}
                        <br />
                        <span className="text-[var(--color-text-muted)]">
                          {item.quantity} x {formatMoney(item.unitPrice)}
                        </span>
                      </td>
                      <td className="py-1 text-right align-top">{formatMoney(item.lineTotal)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <div className="my-3 border-t border-dashed border-[var(--color-border)]" />

              <div className="space-y-0.5 text-xs">
                <div className="flex justify-between">
                  <span>Subtotal</span>
                  <span>{formatMoney(sale.subtotal)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Tax</span>
                  <span>{formatMoney(sale.tax)}</span>
                </div>
                <div className="flex justify-between text-sm font-bold">
                  <span>Total</span>
                  <span>{formatMoney(sale.total)}</span>
                </div>
              </div>

              <div className="my-3 border-t border-dashed border-[var(--color-border)]" />

              <div className="space-y-0.5 text-xs">
                <div className="flex justify-between">
                  <span>Payment method</span>
                  <span>{sale.paymentMethod}</span>
                </div>
                {sale.paymentMethod === "CASH" && (
                  <>
                    <div className="flex justify-between">
                      <span>Amount tendered</span>
                      <span>{formatMoney(sale.amountTendered)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Change due</span>
                      <span>{formatMoney(sale.changeDue)}</span>
                    </div>
                  </>
                )}
              </div>

              <div className="mt-4 text-center text-xs text-[var(--color-text-muted)]">
                Thank you for your purchase
              </div>
            </div>
          </CardBody>
        </Card>
      )}
    </PageLayout>
  );
}
