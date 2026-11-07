import { redirect } from "next/navigation";
import { getAuthUser } from "@/lib/auth";
import AuditClient from "./AuditClient";

export default async function AuditPage() {
  const user = await getAuthUser();
  if (user?.role === "CASHIER") {
    redirect("/dashboard");
  }

  return <AuditClient />;
}
