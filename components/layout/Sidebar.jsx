"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import clsx from "clsx";
import {
  LayoutDashboard,
  ShoppingCart,
  Boxes,
  Package,
  Download,
  Truck,
  Receipt,
  RotateCcw,
  BarChart3,
  Users2,
  UserCog,
  Settings,
  Cross,
  ChevronDown,
  Building2,
  ClipboardList,
} from "lucide-react";

// Single source of truth for the primary nav. Each future phase lights up
// its own route — the shell (Phase 1) just needs the structure and icons
// to already be correct so nothing shifts later.
// `roles` restricts a nav item to specific roles (Admin/Pharmacist for
// supplier & stock-in data — Cashier gets no access at all there, per
// Phase 4; Admin-only for Users, closing a Phase 2 gap where a non-Admin
// could see the link and just hit a 403). Items without `roles` stay
// visible to everyone, as they were before Phase 4.
const NAV_ITEMS = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/pos", label: "POS", icon: ShoppingCart },
  { href: "/inventory", label: "Inventory", icon: Boxes },
  { href: "/products", label: "Products", icon: Package },
  { href: "/stock-in", label: "Stock In", icon: Download, roles: ["ADMIN", "PHARMACIST"] },
  { href: "/suppliers", label: "Suppliers", icon: Truck, roles: ["ADMIN", "PHARMACIST"] },
  { href: "/sales", label: "Sales", icon: Receipt },
  { href: "/returns", label: "Returns", icon: RotateCcw, roles: ["ADMIN", "PHARMACIST"] },
  { href: "/reports", label: "Reports", icon: BarChart3, roles: ["ADMIN", "PHARMACIST"] },
  { href: "/audit", label: "Audit", icon: ClipboardList, roles: ["ADMIN", "PHARMACIST"] },
  { href: "/customers", label: "Customers", icon: Users2 },
  { href: "/users", label: "Users", icon: UserCog, roles: ["ADMIN"] },
  { href: "/settings", label: "Settings", icon: Settings },
];

export default function Sidebar({ className, role }) {
  const pathname = usePathname();
  const items = NAV_ITEMS.filter((item) => !item.roles || item.roles.includes(role));

  return (
    <aside
      className={clsx(
        "flex h-full w-64 shrink-0 flex-col bg-[var(--color-brand-900)] text-white",
        className
      )}
    >
      <div className="flex items-center gap-2.5 px-6 py-6">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-white/10">
          <Cross className="h-5 w-5 text-white" strokeWidth={2.5} />
        </div>
        <div className="leading-tight">
          <p className="text-base font-bold tracking-tight">MedCare</p>
          <p className="text-[11px] font-medium tracking-widest text-white/60">PHARMACY</p>
        </div>
      </div>

      <nav className="flex-1 space-y-1 overflow-y-auto px-3 pb-4">
        {items.map(({ href, label, icon: Icon }) => {
          const isActive = pathname === href || pathname?.startsWith(href + "/");
          return (
            <Link
              key={href}
              href={href}
              className={clsx(
                "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                isActive
                  ? "bg-[var(--color-brand-600)] text-white"
                  : "text-white/70 hover:bg-white/5 hover:text-white"
              )}
            >
              <Icon className="h-[18px] w-[18px] shrink-0" />
              {label}
            </Link>
          );
        })}
      </nav>

      <button
        type="button"
        className="mx-3 mb-3 flex items-center gap-3 rounded-lg border border-white/10 px-3 py-3 text-left hover:bg-white/5"
      >
        <div className="flex h-8 w-8 items-center justify-center rounded-md bg-white/10">
          <Building2 className="h-4 w-4" />
        </div>
        <div className="min-w-0 flex-1 leading-tight">
          <p className="truncate text-xs font-semibold text-white">Pharmacy Branch</p>
          <p className="truncate text-xs text-white/60">Main Branch</p>
        </div>
        <ChevronDown className="h-4 w-4 shrink-0 text-white/60" />
      </button>
    </aside>
  );
}
