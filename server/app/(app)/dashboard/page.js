import { getAuthUser } from "@/lib/auth";
import DashboardClient from "./DashboardClient";

export default async function DashboardPage() {
  const user = await getAuthUser();
  return <DashboardClient role={user?.role} />;
}
