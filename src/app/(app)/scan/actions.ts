"use server";

import { createClient } from "@/lib/supabase/server";
import { getSessionUser, type WorkflowStage } from "@/lib/auth/session";
import { type EntityType } from "@/lib/workflow";

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

  const supabase = await createClient();

  // One round-trip: the `record_scan` RPC does auth, the station check, the
  // sequential-order check and the insert entirely inside Postgres (every read
  // is a local index lookup). This replaces ~4 sequential network hops — the
  // dominant cost when the DB region is far from the operator. See
  // supabase/migrations/0018_record_scan_rpc.sql.
  const { data, error } = await supabase.rpc("record_scan", {
    p_stage: input.stage,
    p_code: code,
    p_entity_type: input.entityType,
    p_result: input.result ?? "ok",
    p_meta: input.meta ?? {},
  });

  if (error) return { error: error.message };
  return (data as ScanResult | null) ?? { error: "Scan failed." };
}
