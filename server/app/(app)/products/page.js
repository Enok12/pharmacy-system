import { getAuthUser } from "@/lib/auth";
import ProductsPageClient from "./ProductsPageClient";

/**
 * Server wrapper so the CASHIER role check happens without an extra
 * client-side fetch — (app)/layout.js already guarantees an authenticated
 * user by the time this renders.
 */
export default async function ProductsPage() {
  const user = await getAuthUser();
  const canWrite = user?.role !== "CASHIER";

  return <ProductsPageClient canWrite={canWrite} />;
}
