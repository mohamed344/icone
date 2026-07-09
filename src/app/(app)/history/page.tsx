import { requireUser } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { ScanHistory, type HistScan } from "@/components/scan/ScanHistory";

export default async function HistoryPage() {
  const session = await requireUser();
  const supabase = await createClient();

  const { data } = await supabase
    .from("scan_events")
    .select("id, code, stage, result, scanned_at")
    .eq("scanned_by", session.userId)
    .order("scanned_at", { ascending: false })
    .limit(5000);

  return <ScanHistory scans={(data as HistScan[]) ?? []} />;
}
