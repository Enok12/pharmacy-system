import { redirect } from "next/navigation";
import { getAuthUser } from "@/lib/auth";
import StockInDetailClient from "./StockInDetailClient";

export default async function StockInDetailPage({ params }) {
  const user = await getAuthUser();
  if (user?.role === "CASHIER") redirect("/dashboard");

  const { id } = await params;
  return <StockInDetailClient id={id} />;
}
