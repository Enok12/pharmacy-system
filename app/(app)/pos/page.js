"use client";

import { useEffect, useRef, useState, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import { Search, ShoppingCart, Plus, Minus, Trash2 } from "lucide-react";
import PageLayout from "@/components/layout/PageLayout";
import Card, { CardBody, CardHeader } from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import ConfirmDialog from "@/components/feedback/ConfirmDialog";
import EmptyState from "@/components/feedback/EmptyState";
import { useToast } from "@/components/feedback/ToastProvider";
import CheckoutModal from "./CheckoutModal";

const CART_STORAGE_KEY = "pos-cart";

function formatMoney(value) {
  return new Intl.NumberFormat(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(
    value || 0
  );
}

// Defensive about a browser blocking storage access (private-mode quota,
// etc.) — the cart still works for the session, it just won't survive a
// reload.
function loadStoredCart() {
  try {
    const raw = sessionStorage.getItem(CART_STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

/**
 * Cart lives entirely in the browser (sessionStorage-backed) until the
 * moment of checkout — no server round-trip for add/update/remove/clear.
 * There used to be a DB-persisted Cart/CartItem here (so a refresh
 * mid-sale wouldn't lose it); that was replaced because writing to
 * Postgres on every click made the register feel slow. sessionStorage
 * gets the same "survives a refresh" property for free, at zero network
 * cost. The one soft guard Phase 6 had here (an add-time "only N in
 * stock" check) is gone too — checkout's own atomic re-validation was
 * always the real enforcement point, and is unchanged below.
 */
export default function PosPage() {
  const { toast } = useToast();
  const router = useRouter();
  const inputRef = useRef(null);

  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [searching, setSearching] = useState(false);

  // Starts empty on both server and the initial client render (SSR has
  // no sessionStorage, so the two must match to avoid a hydration
  // mismatch) — the real cart loads client-side just after mount below.
  const [items, setItems] = useState([]);
  const [hydrated, setHydrated] = useState(false);
  const [clearOpen, setClearOpen] = useState(false);
  const [checkoutOpen, setCheckoutOpen] = useState(false);

  useEffect(() => {
    setItems(loadStoredCart());
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return; // don't clobber sessionStorage with [] before it's loaded
    try {
      sessionStorage.setItem(CART_STORAGE_KEY, JSON.stringify(items));
    } catch {
      // sessionStorage unavailable — cart still works in-memory for this session
    }
  }, [items, hydrated]);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // Debounced live search — also doubles as the barcode result set: a
  // scan (fast digits + Enter) checks this same list for an exact match.
  useEffect(() => {
    if (!query.trim()) {
      setResults([]);
      return;
    }
    setSearching(true);
    const timer = setTimeout(async () => {
      try {
        const params = new URLSearchParams({ search: query.trim(), isActive: "true", pageSize: "10" });
        const res = await fetch(`/api/v1/products?${params}`);
        const json = await res.json();
        if (json.success) setResults(json.data.products);
      } finally {
        setSearching(false);
      }
    }, 250);
    return () => clearTimeout(timer);
  }, [query]);

  const cart = useMemo(() => {
    const lines = items.map((item) => {
      const unitPrice = Number(item.product.sellingPrice);
      const taxRate = Number(item.product.taxRate);
      const lineSubtotal = item.quantity * unitPrice;
      const lineTax = (lineSubtotal * taxRate) / 100;
      return {
        productId: item.productId,
        product: item.product,
        quantity: item.quantity,
        unitPrice,
        lineTotal: lineSubtotal + lineTax,
      };
    });
    const subtotal = lines.reduce((sum, l) => sum + l.quantity * l.unitPrice, 0);
    const tax = lines.reduce((sum, l) => sum + (l.lineTotal - l.quantity * l.unitPrice), 0);
    return { items: lines, subtotal, tax, total: subtotal + tax };
  }, [items]);

  function addToCart(product, quantity = 1) {
    setItems((current) => {
      const existing = current.find((i) => i.productId === product.id);
      if (existing) {
        return current.map((i) =>
          i.productId === product.id ? { ...i, quantity: i.quantity + quantity } : i
        );
      }
      return [...current, { productId: product.id, product, quantity }];
    });
    setQuery("");
    setResults([]);
    inputRef.current?.focus();
  }

  function handleSearchKeyDown(e) {
    if (e.key !== "Enter") return;
    const typed = query.trim();
    if (!typed) return;
    const match = results.find((r) => r.barcode && r.barcode === typed);
    if (match) addToCart(match);
  }

  function updateQuantity(productId, quantity) {
    if (quantity <= 0) {
      removeItem(productId);
      return;
    }
    setItems((current) => current.map((i) => (i.productId === productId ? { ...i, quantity } : i)));
  }

  function removeItem(productId) {
    setItems((current) => current.filter((i) => i.productId !== productId));
  }

  function handleClearCart() {
    setItems([]);
    setClearOpen(false);
  }

  function handleCheckoutSuccess(sale) {
    setItems([]);
    toast({ tone: "success", title: `Sale #${sale.saleNumber} completed` });
    router.push(`/sales/${sale.id}`);
  }

  return (
    <PageLayout title="POS" description="Search or scan a product to add it to the sale.">
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <Card>
            <CardBody>
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--color-text-muted)]" />
                <input
                  ref={inputRef}
                  type="text"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  onKeyDown={handleSearchKeyDown}
                  placeholder="Scan a barcode or search by product name..."
                  className="h-12 w-full rounded-lg border border-[var(--color-border)] bg-white pl-10 pr-4 text-base text-[var(--color-text-primary)] focus:border-[var(--color-brand-600)] focus:outline-none focus:ring-2 focus:ring-[var(--color-brand-600)]/20"
                  autoComplete="off"
                />
              </div>

              {query.trim() && (
                <div className="mt-4 divide-y divide-[var(--color-border)] rounded-lg border border-[var(--color-border)]">
                  {searching && results.length === 0 && (
                    <p className="p-4 text-sm text-[var(--color-text-muted)]">Searching...</p>
                  )}
                  {!searching && results.length === 0 && (
                    <p className="p-4 text-sm text-[var(--color-text-muted)]">No products match &ldquo;{query}&rdquo;.</p>
                  )}
                  {results.map((product) => (
                    <button
                      key={product.id}
                      type="button"
                      onClick={() => addToCart(product)}
                      className="flex w-full items-center justify-between gap-4 px-4 py-3 text-left hover:bg-[var(--color-surface-muted)]"
                    >
                      <div className="min-w-0">
                        <p className="truncate font-medium text-[var(--color-text-primary)]">{product.name}</p>
                        <p className="text-xs text-[var(--color-text-muted)]">
                          {product.barcode || "No barcode"} · {product.category.name}
                        </p>
                      </div>
                      <p className="shrink-0 font-medium text-[var(--color-text-primary)]">
                        {formatMoney(product.sellingPrice)}
                      </p>
                    </button>
                  ))}
                </div>
              )}
            </CardBody>
          </Card>
        </div>

        <div>
          <Card>
            <CardHeader>
              <h2 className="text-sm font-semibold text-[var(--color-text-primary)]">Cart</h2>
              {cart.items.length > 0 && (
                <Button variant="ghost" size="sm" onClick={() => setClearOpen(true)}>
                  Clear
                </Button>
              )}
            </CardHeader>
            <CardBody>
              {cart.items.length === 0 && (
                <EmptyState
                  icon={ShoppingCart}
                  title="Cart is empty"
                  message="Search or scan a product to add it here."
                />
              )}
              {cart.items.length > 0 && (
                <>
                  <ul className="space-y-4">
                    {cart.items.map((item) => (
                      <li key={item.productId} className="flex items-start justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium text-[var(--color-text-primary)]">
                            {item.product.name}
                          </p>
                          <p className="text-xs text-[var(--color-text-muted)]">
                            {formatMoney(item.unitPrice)} each
                          </p>
                          <div className="mt-1.5 flex items-center gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              disabled={item.quantity <= 1}
                              onClick={() => updateQuantity(item.productId, item.quantity - 1)}
                              aria-label={`Decrease quantity of ${item.product.name}`}
                            >
                              <Minus className="h-3.5 w-3.5" />
                            </Button>
                            <span className="w-6 text-center text-sm">{item.quantity}</span>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => updateQuantity(item.productId, item.quantity + 1)}
                              aria-label={`Increase quantity of ${item.product.name}`}
                            >
                              <Plus className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </div>
                        <div className="flex shrink-0 flex-col items-end gap-1.5">
                          <p className="text-sm font-semibold text-[var(--color-text-primary)]">
                            {formatMoney(item.lineTotal)}
                          </p>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => removeItem(item.productId)}
                            aria-label={`Remove ${item.product.name}`}
                          >
                            <Trash2 className="h-3.5 w-3.5 text-[var(--color-danger)]" />
                          </Button>
                        </div>
                      </li>
                    ))}
                  </ul>

                  <div className="mt-5 space-y-1.5 border-t border-[var(--color-border)] pt-4 text-sm">
                    <div className="flex justify-between text-[var(--color-text-secondary)]">
                      <span>Subtotal</span>
                      <span>{formatMoney(cart.subtotal)}</span>
                    </div>
                    <div className="flex justify-between text-[var(--color-text-secondary)]">
                      <span>Tax</span>
                      <span>{formatMoney(cart.tax)}</span>
                    </div>
                    <div className="flex justify-between text-base font-semibold text-[var(--color-text-primary)]">
                      <span>Total</span>
                      <span>{formatMoney(cart.total)}</span>
                    </div>
                  </div>

                  <Button className="mt-5 w-full" onClick={() => setCheckoutOpen(true)}>
                    Checkout
                  </Button>
                </>
              )}
            </CardBody>
          </Card>
        </div>
      </div>

      <ConfirmDialog
        isOpen={clearOpen}
        title="Clear the cart?"
        description="All items will be removed from this sale."
        confirmLabel="Clear cart"
        variant="danger"
        onConfirm={handleClearCart}
        onCancel={() => setClearOpen(false)}
      />

      <CheckoutModal
        isOpen={checkoutOpen}
        onClose={() => setCheckoutOpen(false)}
        items={items}
        total={cart.total}
        onSuccess={handleCheckoutSuccess}
      />
    </PageLayout>
  );
}
