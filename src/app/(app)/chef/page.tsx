import { requireRole } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { ChefView, type QcRow } from "@/components/chef/ChefView";
import { WORKFLOW_STAGES, type WorkflowStage } from "@/lib/workflow";

export default async function ChefPage() {
  const { profile } = await requireRole(["chef_de_ligne"]);
  const supabase = await createClient();

  // A supervisor oversees their whole line unless the admin narrowed them.
  const allowed = profile?.allowed_stations ?? [];
  const stages: WorkflowStage[] = allowed.length ? allowed : [...WORKFLOW_STAGES];

  // QC#2 decisions on the supervisor's line (RLS scopes to their line).
  const { data } = await supabase
    .from("qc_checks")
    .select("id, item_id, decision, reason, overridden_by, decided_at")
    .eq("check_type", "qc2")
    .order("decided_at", { ascending: false })
    .limit(25);

  return <ChefView rows={(data as QcRow[]) ?? []} stages={stages} />;
}
