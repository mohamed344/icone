import { requireUser } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { ScanHistory, type HistScan } from "@/components/scan/ScanHistory";

export default async function HistoryPage() {
  const session = await requireUser();
  const supabase = await createClient();

  // Supervisors oversee the whole line: chef/admin see every scan (with who
  // performed it); operators see only their own. RLS already permits the broad
  // read (see migration 0007) — the scope is an app-level product decision.
  const role = session.profile?.role;
  const seeAll = role === "chef_de_ligne" || role === "admin";

  let query = supabase
    .from("scan_events")
    .select("id, code, stage, result, scanned_at, scanned_by")
    .order("scanned_at", { ascending: false })
    .limit(5000);
  if (!seeAll) query = query.eq("scanned_by", session.userId);

  const { data } = await query;
  const rows = (data as (HistScan & { scanned_by: string | null })[]) ?? [];

  let scans: HistScan[] = rows;
  if (seeAll) {
    const { data: profs } = await supabase.from("profiles").select("id, full_name");
    const nameById = new Map((profs ?? []).map((p) => [p.id, p.full_name ?? "—"]));
    scans = rows.map((r) => ({ ...r, who: r.scanned_by ? (nameById.get(r.scanned_by) ?? "—") : "—" }));
  }

  return <ScanHistory scans={scans} scope={seeAll ? "all" : "own"} />;
}
