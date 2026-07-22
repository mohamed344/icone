import { requireRole } from "@/lib/auth/session";
import { getStockInventory } from "@/lib/admin/stock";
import { AdminStock } from "@/components/admin/AdminStock";

export default async function AdminStockPage() {
  await requireRole(["admin"]);
  const inventory = await getStockInventory();
  return <AdminStock inventory={inventory} />;
}
