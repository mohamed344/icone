import { requireRole } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { AdminOverview, type RecentScan } from "@/components/admin/AdminOverview";

export default async function AdminPage() {
  await requireRole(["admin"]);
  const supabase = await createClient();

  const [emp, scans, recent] = await Promise.all([
    supabase.from("profiles").select("*", { count: "exact", head: true }),
    supabase.from("scan_events").select("*", { count: "exact", head: true }),
    supabase
      .from("scan_events")
      .select("id, stage, code, entity_type, scanned_at")
      .order("scanned_at", { ascending: false })
      .limit(8),
  ]);

  return (
    <AdminOverview
      employees={emp.count ?? 0}
      scans={scans.count ?? 0}
      recent={(recent.data as RecentScan[]) ?? []}
    />
  );
}
