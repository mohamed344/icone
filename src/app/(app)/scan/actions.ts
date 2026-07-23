"use server";

import { createClient } from "@/lib/supabase/server";
import { getSessionUser, type WorkflowStage } from "@/lib/auth/session";
import { roleCan } from "@/lib/auth/permissions";
import { getEnabledStages } from "@/lib/auth/steps";
import { authorizeScan } from "@/lib/scan/guard";
import { WORKFLOW_STAGES, type EntityType } from "@/lib/workflow";

export type { EntityType } from "@/lib/workflow";

export interface ScanInput {
  stage: WorkflowStage;
  code: string;
  entityType: EntityType;
  result?: "ok" | "fail" | "conform" | "non_conform" | "approved" | "rejected" | "pending";
  meta?: Record<string, unknown>;
}

export interface ScanResult {
  ok?: boolean;
  id?: string;
  at?: string;
  error?: string;
  /** Sequence-specific failures (localized by the client). */
  reason?: "out_of_order" | "step_off" | "completed";
  expectedStage?: WorkflowStage;
  /** True when the code has never been scanned anywhere (out_of_order only). */
  notStarted?: boolean;
  /** On success: the step this product moves to next (null = finished). */
  nextStage?: WorkflowStage | null;
}

function nextEnabledAfter(stage: WorkflowStage, enabledSet: Set<WorkflowStage>): WorkflowStage | null {
  for (let i = WORKFLOW_STAGES.indexOf(stage) + 1; i < WORKFLOW_STAGES.length; i++) {
    if (enabledSet.has(WORKFLOW_STAGES[i])) return WORKFLOW_STAGES[i];
  }
  return null;
}

export interface StageScanRow {
  code: string;
  at: string;
  result: string;
}

/**
 * Best-effort: where is a scanned code right now in the pipeline? Used to turn a
 * bare "not waiting here" error into a friendly "it's currently at {stage}" hint.
 * Checks the per-unit, carton and box tables, then falls back to the last scan.
 */
export async function locateCode(code: string): Promise<{ stage: WorkflowStage | null }> {
  const c = code?.trim();
  if (!c) return { stage: null };
  const supabase = await createClient();

  type Stage = WorkflowStage | null;
  const unitBy = (serial: string) =>
    supabase.from("pipeline_units").select("current_stage").eq("serial", serial).maybeSingle();
  const itemBy = (serial: string) =>
    supabase.from("items").select("current_stage").eq("serial_number", serial).maybeSingle();
  const lastBy = (serial: string) =>
    supabase
      .from("scan_events")
      .select("stage")
      .eq("code", serial)
      .order("scanned_at", { ascending: false })
      .limit(1)
      .maybeSingle();

  // First pass: every lookup keyed on the raw code, all in one parallel batch
  // (each column is unique/indexed, so these are cheap seeks).
  const [unitRes, linkRes, cartonRes, boxRes, itemRes0, lastRes0] = await Promise.all([
    unitBy(c),
    supabase.from("carte_dimo_links").select("carte_code").eq("dimo_code", c).maybeSingle(),
    supabase.from("pipeline_cartons").select("current_stage").eq("code", c).maybeSingle(),
    supabase.from("otp_boxes").select("current_stage, qc_state, status").eq("box_code", c).maybeSingle(),
    itemBy(c),
    lastBy(c),
  ]);

  // 1) A per-unit carte, by its own serial.
  const unitStage = (unitRes.data as { current_stage: Stage } | null)?.current_stage ?? null;
  if (unitStage) return { stage: unitStage };

  // 1a) Otherwise the code may be a dimo linked to a carte — re-resolve on the
  //     carte's serial (unit / item / last scan all key on it).
  let item = itemRes0.data as { current_stage: Stage } | null;
  let lastStage = (lastRes0.data as { stage: WorkflowStage } | null)?.stage ?? null;
  const link = linkRes.data as { carte_code: string } | null;
  if (!unitRes.data && link) {
    const [uRes, iRes, lRes] = await Promise.all([
      unitBy(link.carte_code),
      itemBy(link.carte_code),
      lastBy(link.carte_code),
    ]);
    const linkedUnitStage = (uRes.data as { current_stage: Stage } | null)?.current_stage ?? null;
    if (linkedUnitStage) return { stage: linkedUnitStage };
    item = iRes.data as { current_stage: Stage } | null;
    lastStage = (lRes.data as { stage: WorkflowStage } | null)?.stage ?? null;
  }

  // 1b) A PCBA article — its current_stage is where it waits next.
  if (item?.current_stage) return { stage: item.current_stage };

  // 2) A carton, by its scannable code.
  const carton = cartonRes.data as { current_stage: Stage } | null;
  if (carton?.current_stage) return { stage: carton.current_stage };

  // 3) A box, by its code — resolve its live location from stage/qc_state/status.
  const box = boxRes.data as { current_stage: Stage; qc_state: string | null; status: string | null } | null;
  if (box) {
    if (box.current_stage) return { stage: box.current_stage };
    if (box.qc_state === "awaiting" || box.qc_state === "rework") return { stage: "qc1_box" };
    if (box.status === "open") return { stage: "otp_validation" };
  }

  // 4) Fallback: the code's most recent scan_events stage.
  return { stage: lastStage };
}

/**
 * Today's scans the current user recorded at `stage` (newest first), so the
 * station's activity log survives leaving and returning to the screen.
 */
export async function getTodayStageScans(stage: WorkflowStage): Promise<StageScanRow[]> {
  const session = await getSessionUser();
  if (!session?.profile) return [];
  const supabase = await createClient();
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const { data } = await supabase
    .from("scan_events")
    .select("code, scanned_at, result")
    .eq("stage", stage)
    .eq("scanned_by", session.userId)
    .gte("scanned_at", start.toISOString())
    .order("scanned_at", { ascending: false })
    .limit(200);
  return ((data as { code: string; scanned_at: string; result: string }[]) ?? []).map((r) => ({
    code: r.code,
    at: r.scanned_at,
    result: r.result,
  }));
}

/**
 * Records one immutable scan into `scan_events` (the traceability audit log)
 * and advances the product to the next step. line_id comes from the caller's
 * profile; RLS enforces same-line writes.
 */
export async function recordScan(input: ScanInput): Promise<ScanResult> {
  const code = input.code?.trim();
  if (!code) return { error: "Empty code." };

  // Fire the station-config read immediately; it is independent of the caller
  // and overlaps the auth check below instead of running after it.
  const enabledStagesP = getEnabledStages();

  const guard = await authorizeScan(input.stage);
  if (!guard.ok) {
    void enabledStagesP; // settled independently; nothing to do on the error path
    return { error: guard.error };
  }
  const { profile, userId, supabase } = guard;

  // Remaining reads are independent → they resolve concurrently.
  // `bypass_sequence` reuses the role_settings row already cached by authorizeScan.
  // The last-event lookup is served by idx_scan_events_code_time (an index seek,
  // not a full audit-log scan). Promise.resolve kicks off the lazy query builder.
  const lastEventP = Promise.resolve(
    supabase
      .from("scan_events")
      .select("stage")
      .eq("code", code)
      .order("scanned_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  );
  const [enabledStages, canBypass] = await Promise.all([
    enabledStagesP,
    roleCan(profile.role, "bypass_sequence"),
  ]);
  const enabledSet = new Set(enabledStages);

  // ---- Sequential enforcement: a product advances 1 → 11 without skipping.
  // Disabled steps are auto-skipped; bypass_sequence (and admin) may scan freely.
  if (!canBypass) {
    if (!enabledSet.has(input.stage)) return { reason: "step_off" };

    const { data: last } = await lastEventP;
    const lastStage = last?.stage as WorkflowStage | undefined;
    const startPos = lastStage ? WORKFLOW_STAGES.indexOf(lastStage) : -1;

    let expected: WorkflowStage | null = null;
    for (let i = startPos + 1; i < WORKFLOW_STAGES.length; i++) {
      if (enabledSet.has(WORKFLOW_STAGES[i])) {
        expected = WORKFLOW_STAGES[i];
        break;
      }
    }

    if (expected === null) return { reason: "completed" };
    if (input.stage !== expected)
      return { reason: "out_of_order", expectedStage: expected, notStarted: lastStage === undefined };
  }

  const { data, error } = await supabase
    .from("scan_events")
    .insert({
      stage: input.stage,
      entity_type: input.entityType,
      code,
      result: input.result ?? "ok",
      scanned_by: userId,
      meta: input.meta ?? {},
    })
    .select("id, scanned_at")
    .single();

  if (error) return { error: error.message };

  return {
    ok: true,
    id: data.id,
    at: data.scanned_at,
    nextStage: nextEnabledAfter(input.stage, enabledSet),
  };
}
