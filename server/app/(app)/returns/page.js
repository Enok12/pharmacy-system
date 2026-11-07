import { redirect } from "next/navigation";
import { getAuthUser } from "@/lib/auth";
import ReturnsHistoryClient from "./ReturnsHistoryClient";

/**
 * Cashier has no access to returns at all (matches Suppliers/Stock-In) —
 * the API already 403s them, this redirect just avoids showing a broken
 * page. Sidebar.jsx also hides this nav item for Cashier.
 */
export default async function ReturnsPage() {
  const user = await getAuthUser();
  if (user?.role === "CASHIER") redirect("/dashboard");

  return <ReturnsHistoryClient />;
}
