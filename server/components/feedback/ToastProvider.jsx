"use client";

import { createContext, useCallback, useContext, useState } from "react";
import { CheckCircle2, XCircle, Info, AlertTriangle, X } from "lucide-react";
import clsx from "clsx";

const ToastContext = createContext(null);

const TONE_STYLES = {
  success: { icon: CheckCircle2, className: "text-[var(--color-success)]" },
  error: { icon: XCircle, className: "text-[var(--color-danger)]" },
  warning: { icon: AlertTriangle, className: "text-[var(--color-warning)]" },
  info: { icon: Info, className: "text-[var(--color-info)]" },
};

let idCounter = 0;

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  const dismiss = useCallback((id) => {
    setToasts((current) => current.filter((t) => t.id !== id));
  }, []);

  const toast = useCallback(
    ({ title, description, tone = "info", duration = 4000 }) => {
      const id = ++idCounter;
      setToasts((current) => [...current, { id, title, description, tone }]);
      if (duration) {
        setTimeout(() => dismiss(id), duration);
      }
      return id;
    },
    [dismiss]
  );

  return (
    <ToastContext.Provider value={{ toast, dismiss }}>
      {children}
      <div className="pointer-events-none fixed bottom-4 right-4 z-[100] flex w-full max-w-sm flex-col gap-2 sm:bottom-6 sm:right-6">
        {toasts.map((t) => {
          const { icon: Icon, className } = TONE_STYLES[t.tone] ?? TONE_STYLES.info;
          return (
            <div
              key={t.id}
              role="status"
              className="pointer-events-auto flex items-start gap-3 rounded-xl border border-[var(--color-border)] bg-white p-4 shadow-lg"
            >
              <Icon className={clsx("mt-0.5 h-5 w-5 shrink-0", className)} />
              <div className="min-w-0 flex-1">
                {t.title && (
                  <p className="text-sm font-semibold text-[var(--color-text-primary)]">
                    {t.title}
                  </p>
                )}
                {t.description && (
                  <p className="mt-0.5 text-sm text-[var(--color-text-secondary)]">
                    {t.description}
                  </p>
                )}
              </div>
              <button
                type="button"
                onClick={() => dismiss(t.id)}
                className="shrink-0 rounded p-0.5 text-[var(--color-text-muted)] hover:bg-[var(--color-surface-muted)]"
                aria-label="Dismiss notification"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}

/**
 * @example
 * const { toast } = useToast();
 * toast({ tone: "success", title: "Product saved" });
 * toast({ tone: "error", title: "Stock-in failed", description: "Quantity must be positive." });
 */
export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within a ToastProvider");
  return ctx;
}
