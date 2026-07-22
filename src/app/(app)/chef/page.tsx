import { requireRole } from "@/lib/auth/session";
import { StationSwitcher } from "@/components/chef/StationSwitcher";
import { StationConsole } from "@/components/scan/StationConsole";
import { CartonQc2Panel } from "@/components/chef/CartonQc2Panel";
import { WaitingByStep } from "@/components/chef/WaitingByStep";
import { getChefCartons } from "@/app/(app)/scan/carton-actions";
import { getWaitingByStep } from "@/lib/chef/waiting";
import { WORKFLOW_STAGES, type WorkflowStage } from "@/lib/workflow";

export default async function ChefPage({
  searchParams,
}: {
  searchParams: Promise<{ station?: string }>;
}) {
  await requireRole(["chef_de_ligne"]);

  // A supervisor may act at ANY station (see isSupervisor / guardStation), so the
  // switcher always spans the whole line — allowed_stations only restricts operators.
  // (Otherwise a station missing from a chef's list — e.g. Réparation added later —
  //  would strand products sent there with no tab to handle them.)
  const stages: WorkflowStage[] = [...WORKFLOW_STAGES];

  // Selected station comes from the URL (station switcher); default to the first.
  const sp = await searchParams;
  const requested = sp.station as WorkflowStage | undefined;
  const station: WorkflowStage = requested && stages.includes(requested) ? requested : stages[0];

  // Carton QC#2 decisions + the codes still waiting at each step.
  const [cartons, waiting] = await Promise.all([getChefCartons(), getWaitingByStep()]);

  return (
    <>
      <StationSwitcher stages={stages} active={station} />
      <StationConsole station={station} />
      <WaitingByStep steps={waiting} />
      {/* The Qualité 2 station's own console handles carton QC#2 — no need to
          repeat the overview card there. */}
      {station !== "qc2_final" && <CartonQc2Panel cartons={cartons} />}
    </>
  );
}
