import { redirect } from "next/navigation";
import { getAuthUser } from "@/lib/auth";
import SuppliersClient from "./SuppliersClient";

/**
 * Cashier has no access to suppliers at all (unlike Products) — the API
 * already 403s them, this redirect just avoids showing a broken page.
 * Sidebar.jsx also hides this nav item for Cashier.
 */
export default async function SuppliersPage() {
  const user = await getAuthUser();
  if (user?.role === "CASHIER") redirect("/dashboard");

  return <SuppliersClient />;
}
