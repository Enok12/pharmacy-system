import { redirect } from "next/navigation";
import { getAuthUser } from "@/lib/auth";
import ReportsClient from "./ReportsClient";

export default async function ReportsPage() {
  const user = await getAuthUser();
  if (user?.role === "CASHIER") {
    redirect("/dashboard");
  }

  return <ReportsClient />;
}
