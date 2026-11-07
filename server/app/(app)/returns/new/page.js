import { redirect } from "next/navigation";
import { getAuthUser } from "@/lib/auth";
import ReturnForm from "./ReturnForm";

export default async function NewReturnPage() {
  const user = await getAuthUser();
  if (user?.role === "CASHIER") redirect("/dashboard");

  return <ReturnForm />;
}
