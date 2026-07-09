"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getSessionUser } from "@/lib/auth/session";
import { notify, operatorIdsAtStage } from "@/lib/notify";
import { nextEnabledStage } from "@/lib/auth/steps";
import type { WorkflowStage } from "@/lib/workflow";

export interface Unit {
  id: string;
  serial: string;
  boxCode: string | null;
  product: string | null;
  currentStage: WorkflowStage | null;
  testResult: string | null;
  problemReason: string | null;
}

interface Row {
  id: string;
  serial: string;
  box_code: string | null;
  product: string | null;
  current_stage: WorkflowStage | null;
  test_result: string | null;
  problem_reason: string | null;
}

const toUnit = (r: Row): Unit => ({
  id: r.id,
  serial: r.serial,
  boxCode: r.box_code,
  product: r.product,
  currentStage: r.current_stage,
  testResult: r.test_result,
  problemReason: r.problem_reason,
});

const SELECT = "id, serial, box_code, product, current_stage, test_result, problem_reason";

export interface UnitResult {
  ok?: boolean;
  error?: string;
  nextStage?: WorkflowStage | null;
}

async function guardStation(stage: WorkflowStage) {
  const session = await getSessionUser();
  const p = session?.profile;
  if (!p) return { error: "Not authenticated." as const };
  const stations = (p.allowed_stations as string[]) ?? [];
  if (p.role !== "admin" && !stations.includes(stage) && p.station !== stage) {
    return { error: "This station is not assigned to you." as const };
  }
  return { session };
}

/** Record a per-unit scan event (audit → history / analytics). */
async function auditScan(userId: string, stage: WorkflowStage, serial: string, result: string, boxId?: string | null) {
  const supabase = await createClient();
  await supabase.from("scan_events").insert({
    stage,
    entity_type: "item",
    code: serial,
    result,
    scanned_by: userId,
    meta: boxId ? { otp_box_id: boxId } : {},
  });
}

/** Units currently waiting at `stage`. */
export async function getUnitQueue(stage: WorkflowStage): Promise<Unit[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("pipeline_units")
    .select(SELECT)
    .eq("current_stage", stage)
    .eq("status", "active")
    .order("updated_at", { ascending: true })
    .limit(200);
  return ((data as Row[]) ?? []).map(toUnit);
}

/** Units returned to reception after repair (the NG → reception loop). */
export async function getRepairedUnits(): Promise<Unit[]> {
  return getUnitQueue("reception");
}

export async function findUnitByCode(stage: WorkflowStage, serial: string): Promise<Unit | null> {
  const s = serial.trim();
  if (!s) return null;
  const supabase = await createClient();
  const { data } = await supabase
    .from("pipeline_units")
    .select(SELECT)
    .eq("current_stage", stage)
    .eq("serial", s)
    .maybeSingle();
  return data ? toUnit(data as Row) : null;
}

async function loadUnit(id: string) {
  const supabase = await createClient();
  const { data } = await supabase.from("pipeline_units").select(SELECT + ", otp_box_id").eq("id", id).single();
  return data as (Row & { otp_box_id: string | null }) | null;
}

/** Advance a unit to the next enabled stage (steps with no decision, e.g. QR Scan). */
export async function passUnit(id: string): Promise<UnitResult> {
  const unit = await loadUnit(id);
  if (!unit?.current_stage) return { error: "Unit not found." };
  const g = await guardStation(unit.current_stage);
  if ("error" in g) return { error: g.error };

  const next = await nextEnabledStage(unit.current_stage);
  const admin = createAdminClient();
  await admin.from("pipeline_units").update({ current_stage: next, status: next ? "active" : "done" }).eq("id", id);
  await auditScan(g.session!.userId, unit.current_stage, unit.serial, "ok", unit.otp_box_id);
  if (next) await notify(await operatorIdsAtStage(next), "box_arrived", null, unit.serial, undefined, next);
  return { ok: true, nextStage: next };
}

/** Test decision: OK → Reprint (skip NG); Problem → NG (reason required). */
export async function testUnit(id: string, decision: "ok" | "problem", reason?: string): Promise<UnitResult> {
  const unit = await loadUnit(id);
  if (unit?.current_stage !== "scan_test") return { error: "Unit is not at the test step." };
  const g = await guardStation("scan_test");
  if ("error" in g) return { error: g.error };
  if (decision === "problem" && !reason?.trim()) return { error: "A description is required." };

  const target: WorkflowStage = decision === "ok" ? "rescan_reprint" : "ng_handling";
  const admin = createAdminClient();
  await admin
    .from("pipeline_units")
    .update({
      current_stage: target,
      test_result: decision,
      problem_reason: decision === "problem" ? reason!.trim() : null,
    })
    .eq("id", id);
  await auditScan(g.session!.userId, "scan_test", unit.serial, decision === "ok" ? "ok" : "fail", unit.otp_box_id);
  await notify(await operatorIdsAtStage(target), "box_arrived", null, unit.serial, undefined, target);
  return { ok: true, nextStage: target };
}

/** NG repair → return the unit to Reception (loop). */
export async function repairUnit(id: string): Promise<UnitResult> {
  const unit = await loadUnit(id);
  if (unit?.current_stage !== "ng_handling") return { error: "Unit is not at the NG step." };
  const g = await guardStation("ng_handling");
  if ("error" in g) return { error: g.error };

  const admin = createAdminClient();
  await admin
    .from("pipeline_units")
    .update({ current_stage: "reception", test_result: null, problem_reason: null })
    .eq("id", id);
  await auditScan(g.session!.userId, "ng_handling", unit.serial, "ok", unit.otp_box_id);
  await notify(await operatorIdsAtStage("reception"), "box_arrived", null, unit.serial, undefined, "reception");
  return { ok: true, nextStage: "reception" };
}

/** Re-receive a repaired unit → back into step 5. */
export async function reReceiveUnit(id: string): Promise<UnitResult> {
  const unit = await loadUnit(id);
  if (unit?.current_stage !== "reception") return { error: "Unit is not awaiting reception." };
  const g = await guardStation("reception");
  if ("error" in g) return { error: g.error };

  const next = await nextEnabledStage("reception");
  const admin = createAdminClient();
  await admin.from("pipeline_units").update({ current_stage: next }).eq("id", id);
  await auditScan(g.session!.userId, "reception", unit.serial, "ok", unit.otp_box_id);
  if (next) await notify(await operatorIdsAtStage(next), "box_arrived", null, unit.serial, undefined, next);
  return { ok: true, nextStage: next };
}

export interface UnitLabel {
  serial: string;
  boxCode: string | null;
  product: string | null;
}

export async function getUnitLabel(id: string): Promise<UnitLabel | null> {
  const unit = await loadUnit(id);
  if (!unit) return null;
  return { serial: unit.serial, boxCode: unit.box_code, product: unit.product };
}

/** Reprint done → advance the unit to the next enabled step. */
export async function markReprinted(id: string): Promise<UnitResult> {
  const unit = await loadUnit(id);
  if (unit?.current_stage !== "rescan_reprint") return { error: "Unit is not at the reprint step." };
  const g = await guardStation("rescan_reprint");
  if ("error" in g) return { error: g.error };

  const next = await nextEnabledStage("rescan_reprint");
  const admin = createAdminClient();
  await admin.from("pipeline_units").update({ current_stage: next, status: next ? "active" : "done" }).eq("id", id);
  await auditScan(g.session!.userId, "rescan_reprint", unit.serial, "ok", unit.otp_box_id);
  if (next) await notify(await operatorIdsAtStage(next), "box_arrived", null, unit.serial, undefined, next);
  return { ok: true, nextStage: next };
}
