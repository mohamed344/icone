import { requireRole } from "@/lib/auth/session";
import { getScanStats, getStockStats } from "@/lib/admin/stats";
import { getCartonMovements } from "@/app/(app)/scan/carton-actions";
import { AdminDashboard } from "@/components/admin/AdminDashboard";

export default async function AdminDashboardPage() {
  await requireRole(["admin"]);
  const [stats, stock, movements] = await Promise.all([
    getScanStats(14),
    getStockStats(),
    getCartonMovements(20),
  ]);
  return <AdminDashboard stats={stats} stock={stock} movements={movements} />;
}
