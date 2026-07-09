import { requireRole } from "@/lib/auth/session";
import { getScanStats } from "@/lib/admin/stats";
import { AdminAnalytics } from "@/components/admin/AdminAnalytics";

export default async function AdminAnalyticsPage() {
  await requireRole(["admin"]);
  const stats = await getScanStats(14);
  return <AdminAnalytics stats={stats} />;
}
