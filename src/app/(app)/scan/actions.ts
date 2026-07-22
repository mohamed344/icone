"use server";

import { createClient } from "@/lib/supabase/server";
import { getSessionUser, type WorkflowStage } from "@/lib/auth/session";
import { roleCan } from "@/lib/auth/permissions";
import { getEnabledStages } from "@/lib/auth/steps";
import { WORKFLOW_STAGES, isSupervisor, type EntityType } from "@/lib/workflow";

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

  // 1) A per-unit carte, by its serial — or by its linked dimo.
  let serial = c;
  const unitBySerial = await supabase
    .from("pipeline_units")
    .select("current_stage")
    .eq("serial", c)
    .maybeSingle();
  let unitStage = (unitBySerial.data as { current_stage: WorkflowStage | null } | null)?.current_stage ?? null;
  if (!unitBySerial.data) {
    const { data: link } = await supabase
      .from("carte_dimo_links")
      .select("carte_code")
      .eq("dimo_code", c)
      .maybeSingle();
    if (link) {
      serial = (link as { carte_code: string }).carte_code;
      const { data: u } = await supabase
        .from("pipeline_units")
        .select("current_stage")
        .eq("serial", serial)
        .maybeSingle();
      unitStage = (u as { current_stage: WorkflowStage | null } | null)?.current_stage ?? null;
    }
  }
  if (unitStage) return { stage: unitStage };

  // 1b) A PCBA article, by its serial — its current_stage is where it waits next
  //     (e.g. a serial that finished Scan PCBA sits at otp_validation).
  const { data: item } = await supabase
    .from("items")
    .select("current_stage")
    .eq("serial_number", serial)
    .maybeSingle();
  if ((item as { current_stage: WorkflowStage | null } | null)?.current_stage) {
    return { stage: (item as { current_stage: WorkflowStage }).current_stage };
  }

  // 2) A carton, by its scannable code.
  const { data: carton } = await supabase
    .from("pipeline_cartons")
    .select("current_stage")
    .eq("code", c)
    .maybeSingle();
  if ((carton as { current_stage: WorkflowStage | null } | null)?.current_stage) {
    return { stage: (carton as { current_stage: WorkflowStage }).current_stage };
  }

  // 3) A box, by its code — resolve its live location from stage/qc_state/status.
  const { data: box } = await supabase
    .from("otp_boxes")
    .select("current_stage, qc_state, status")
    .eq("box_code", c)
    .maybeSingle();
  if (box) {
    const b = box as { current_stage: WorkflowStage | null; qc_state: string | null; status: string | null };
    if (b.current_stage) return { stage: b.current_stage };
    if (b.qc_state === "awaiting" || b.qc_state === "rework") return { stage: "qc1_box" };
    if (b.status === "open") return { stage: "otp_validation" };
  }

  // 4) Fallback: the code's most recent scan_events stage.
  const { data: last } = await supabase
    .from("scan_events")
    .select("stage")
    .eq("code", serial)
    .order("scanned_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return { stage: (last as { stage: WorkflowStage } | null)?.stage ?? null };
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

  const session = await getSessionUser();
  if (!session?.profile) return { error: "Not authenticated." };

  const { profile, userId } = session;
  if (!(await roleCan(profile.role, "scan"))) {
    return { error: "Your role doesn't have permission to scan." };
  }
  // Supervisors (admin, chef de ligne) may act at any station.
  if (!isSupervisor(profile.role)) {
    if (profile.allowed_stations?.length && !profile.allowed_stations.includes(input.stage)) {
      return { error: "This station is not assigned to you." };
    }
    if (!profile.allowed_stations?.length) {
      return { error: "No station assigned to your account. Ask an admin." };
    }
  }

  const supabase = await createClient();
  const enabledSet = new Set(await getEnabledStages());

  // ---- Sequential enforcement: a product advances 1 → 11 without skipping.
  // Disabled steps are auto-skipped; bypass_sequence (and admin) may scan freely.
  const canBypass = await roleCan(profile.role, "bypass_sequence");
  if (!canBypass) {
    if (!enabledSet.has(input.stage)) return { reason: "step_off" };

    const { data: last } = await supabase
      .from("scan_events")
      .select("stage")
      .eq("code", code)
      .order("scanned_at", { ascending: false })
      .limit(1)
      .maybeSingle();

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
