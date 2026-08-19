import { redirect } from "next/navigation";
import { getAuthUser } from "@/lib/auth";
import ReturnDetailClient from "./ReturnDetailClient";

export default async function ReturnDetailPage({ params }) {
  const user = await getAuthUser();
  if (user?.role === "CASHIER") redirect("/dashboard");

  const { id } = await params;
  return <ReturnDetailClient id={id} />;
}
