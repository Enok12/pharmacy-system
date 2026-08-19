"use client";

import { useState } from "react";
import Sidebar from "./Sidebar";
import Header from "./Header";

export default function AppShell({ children, user }) {
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  return (
    <div className="flex h-screen overflow-hidden bg-[var(--background)]">
      {/* Desktop sidebar */}
      <Sidebar className="hidden lg:flex" role={user?.role} />

      {/* Mobile sidebar (slide-over) */}
      {mobileNavOpen && (
        <div className="fixed inset-0 z-[80] lg:hidden">
          <div
            className="absolute inset-0 bg-black/40"
            onClick={() => setMobileNavOpen(false)}
            aria-hidden="true"
          />
          <Sidebar className="relative flex" role={user?.role} />
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        <Header user={user} onMenuClick={() => setMobileNavOpen((open) => !open)} />
        <main className="flex-1 overflow-y-auto">{children}</main>
      </div>
    </div>
  );
}
