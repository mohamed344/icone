import "server-only";
import { createClient } from "@/lib/supabase/server";
import { WORKFLOW_STAGES, type WorkflowStage } from "@/lib/workflow";

export interface StepRow {
  stage: WorkflowStage;
  position: number;
  enabled: boolean;
}

/** All 11 steps in order with their enabled flag (falls back to all-on). */
export async function getAllSteps(): Promise<StepRow[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("workflow_steps")
    .select("stage, position, enabled")
    .order("position");

  if (!data || data.length === 0) {
    return WORKFLOW_STAGES.map((stage, i) => ({ stage, position: i + 1, enabled: true }));
  }
  return data as StepRow[];
}

/** Enabled steps in canonical order. */
export async function getEnabledStages(): Promise<WorkflowStage[]> {
  const steps = await getAllSteps();
  const enabled = new Set(steps.filter((s) => s.enabled).map((s) => s.stage));
  return WORKFLOW_STAGES.filter((s) => enabled.has(s));
}

/** The first enabled stage after `stage`, or null if it's the last. */
export async function nextEnabledStage(stage: WorkflowStage): Promise<WorkflowStage | null> {
  const enabled = new Set(await getEnabledStages());
  for (let i = WORKFLOW_STAGES.indexOf(stage) + 1; i < WORKFLOW_STAGES.length; i++) {
    if (enabled.has(WORKFLOW_STAGES[i])) return WORKFLOW_STAGES[i];
  }
  return null;
}
