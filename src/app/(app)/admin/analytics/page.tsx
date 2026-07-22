import { requireRole } from "@/lib/auth/session";
import { getScanStats, getStockStats } from "@/lib/admin/stats";
import { AdminAnalytics } from "@/components/admin/AdminAnalytics";

export default async function AdminAnalyticsPage() {
  await requireRole(["admin"]);
  const [stats, stock] = await Promise.all([getScanStats(14), getStockStats()]);
  return <AdminAnalytics stats={stats} stock={stock} />;
}
