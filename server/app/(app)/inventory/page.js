import { getAuthUser } from "@/lib/auth";
import InventoryPageClient from "./InventoryPageClient";

/**
 * Server wrapper so the CASHIER role check happens without an extra
 * client-side fetch — (app)/layout.js already guarantees an authenticated
 * user by the time this renders. Mirrors Phase 3's Products `canWrite`
 * pattern, reintroduced here now that Phase 8 adds a write action
 * (Adjust) to what was previously a read-only page.
 */
export default async function InventoryPage() {
  const user = await getAuthUser();
  const canAdjust = user?.role !== "CASHIER";

  return <InventoryPageClient canAdjust={canAdjust} />;
}
