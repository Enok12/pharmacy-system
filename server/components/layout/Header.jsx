"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Search, Bell, HelpCircle, ChevronDown, Menu, LogOut } from "lucide-react";

const ROLE_LABELS = { ADMIN: "Admin", PHARMACIST: "Pharmacist", CASHIER: "Cashier" };

function initials(name = "") {
  return (
    name
      .trim()
      .split(/\s+/)
      .map((part) => part[0])
      .slice(0, 2)
      .join("")
      .toUpperCase() || "?"
  );
}

export default function Header({ onMenuClick, user }) {
  const router = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);

  async function handleLogout() {
    setMenuOpen(false);
    await fetch("/api/v1/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  return (
    <header className="flex h-16 shrink-0 items-center gap-4 border-b border-[var(--color-border)] bg-[var(--color-surface)] px-4 sm:px-6">
      <button
        type="button"
        onClick={onMenuClick}
        className="rounded-md p-2 text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-muted)] lg:hidden"
        aria-label="Toggle navigation"
      >
        <Menu className="h-5 w-5" />
      </button>

      <div className="relative hidden max-w-md flex-1 sm:block">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--color-text-muted)]" />
        <input
          type="text"
          placeholder="Search products, invoices, suppliers..."
          className="h-10 w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-muted)] pl-10 pr-16 text-sm text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)] focus:border-[var(--color-brand-600)] focus:outline-none focus:ring-2 focus:ring-[var(--color-brand-600)]/20"
        />
        <kbd className="absolute right-3 top-1/2 -translate-y-1/2 rounded border border-[var(--color-border)] bg-white px-1.5 py-0.5 text-[10px] font-medium text-[var(--color-text-muted)]">
          Ctrl+K
        </kbd>
      </div>

      <div className="ml-auto flex items-center gap-1.5 sm:gap-3">
        <button
          type="button"
          className="relative rounded-full p-2 text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-muted)]"
          aria-label="Notifications"
        >
          <Bell className="h-5 w-5" />
          <span className="absolute right-1.5 top-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-[var(--color-danger)] text-[10px] font-semibold text-white">
            3
          </span>
        </button>

        <button
          type="button"
          className="hidden rounded-full p-2 text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-muted)] sm:block"
          aria-label="Help"
        >
          <HelpCircle className="h-5 w-5" />
        </button>

        <div className="relative">
          <button
            type="button"
            onClick={() => setMenuOpen((open) => !open)}
            className="flex items-center gap-2.5 rounded-lg py-1.5 pl-1.5 pr-2 hover:bg-[var(--color-surface-muted)]"
          >
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[var(--color-brand-700)] text-sm font-semibold text-white">
              {initials(user?.name)}
            </div>
            <div className="hidden text-left leading-tight sm:block">
              <p className="text-sm font-semibold text-[var(--color-text-primary)]">
                {user?.name || "Unknown"}
              </p>
              <p className="text-xs text-[var(--color-text-muted)]">
                {ROLE_LABELS[user?.role] || user?.role}
              </p>
            </div>
            <ChevronDown className="hidden h-4 w-4 text-[var(--color-text-muted)] sm:block" />
          </button>

          {menuOpen && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setMenuOpen(false)} />
              <div className="absolute right-0 z-20 mt-2 w-44 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] py-1 shadow-lg">
                <button
                  type="button"
                  onClick={handleLogout}
                  className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-[var(--color-text-primary)] hover:bg-[var(--color-surface-muted)]"
                >
                  <LogOut className="h-4 w-4" />
                  Log out
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
