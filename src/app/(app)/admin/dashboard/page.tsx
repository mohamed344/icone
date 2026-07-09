import { requireRole } from "@/lib/auth/session";
import { getScanStats } from "@/lib/admin/stats";
import { AdminDashboard } from "@/components/admin/AdminDashboard";

export default async function AdminDashboardPage() {
  await requireRole(["admin"]);
  const stats = await getScanStats(14);
  return <AdminDashboard stats={stats} />;
}
