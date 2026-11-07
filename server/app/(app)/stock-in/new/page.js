import { redirect } from "next/navigation";
import { getAuthUser } from "@/lib/auth";
import StockInForm from "./StockInForm";

export default async function NewStockInPage() {
  const user = await getAuthUser();
  if (user?.role === "CASHIER") redirect("/dashboard");

  return <StockInForm />;
}
