import { requireRole } from "@/lib/auth/session";
import { OperatorScan } from "@/components/scan/OperatorScan";
import { StationConsole } from "@/components/scan/StationConsole";
import type { WorkflowStage } from "@/lib/workflow";

export default async function OperatorPage() {
  const { profile } = await requireRole(["operator"]);

  const allowed = profile?.allowed_stations ?? [];
  const stages: WorkflowStage[] = allowed.length
    ? allowed
    : profile?.station
      ? [profile.station]
      : [];
  const station = stages.length === 1 ? stages[0] : null;

  // Single station → its specialized console; multi/zero → generic panel.
  if (station) return <StationConsole station={station} />;
  return <OperatorScan stages={stages} />;
}
