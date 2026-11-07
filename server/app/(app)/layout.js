import { redirect } from "next/navigation";
import AppShell from "@/components/layout/AppShell";
import { getAuthUser } from "@/lib/auth";

// Everything under the (app) route group shares the sidebar/header shell.
// middleware.js already redirects unauthenticated requests to /login before
// this layout ever renders — the check here is defense-in-depth, and lets
// us pass the real signed-in user down to the header.
export default async function AppGroupLayout({ children }) {
  const user = await getAuthUser();
  if (!user) redirect("/login");

  return <AppShell user={user}>{children}</AppShell>;
}
