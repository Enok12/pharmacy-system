import { redirect } from "next/navigation";
import { getAuthUser } from "@/lib/auth";
import StockInHistoryClient from "./StockInHistoryClient";

export default async function StockInPage() {
  const user = await getAuthUser();
  if (user?.role === "CASHIER") redirect("/dashboard");

  return <StockInHistoryClient />;
}
