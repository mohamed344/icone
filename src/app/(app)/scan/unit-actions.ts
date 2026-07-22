"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getSessionUser } from "@/lib/auth/session";
import { notify, operatorIdsAtStage } from "@/lib/notify";
import { nextEnabledStage } from "@/lib/auth/steps";
import { isSupervisor, type WorkflowStage } from "@/lib/workflow";

export interface Unit {
  id: string;
  serial: string;
  boxCode: string | null;
  product: string | null;
  currentStage: WorkflowStage | null;
  testResult: string | null;
  problemReason: string | null;
  /** Linked dimo barcode (null before Binding) — the product's physical label. */
  dimo: string | null;
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
  dimo: null,
});

const SELECT = "id, serial, box_code, product, current_stage, test_result, problem_reason";

/**
 * Attach each unit's linked dimo barcode (from carte_dimo_links). Post-Binding
 * stations (Test, NG, Reparation, Reprint) display the dimo — the product's
 * physical label — not the internal carte serial. Null before Binding.
 */
async function attachDimo(
  supabase: Awaited<ReturnType<typeof createClient>>,
  units: Unit[],
): Promise<Unit[]> {
  if (units.length === 0) return units;
  const { data } = await supabase
    .from("carte_dimo_links")
    .select("carte_code, dimo_code")
    .in("carte_code", units.map((u) => u.serial));
  const byCarte = new Map(
    ((data as { carte_code: string; dimo_code: string }[]) ?? []).map((l) => [l.carte_code, l.dimo_code]),
  );
  return units.map((u) => ({ ...u, dimo: byCarte.get(u.serial) ?? null }));
}

export interface UnitResult {
  ok?: boolean;
  error?: string;
  /** Localized by the client. `use_dimo`: a carte was scanned where the dimo is required. */
  reason?: "not_found" | "use_dimo";
  nextStage?: WorkflowStage | null;
  serial?: string;
  /** The unit's dimo barcode (its physical label) — shown in confirmations. */
  dimo?: string | null;
}

async function guardStation(stage: WorkflowStage) {
  const session = await getSessionUser();
  const p = session?.profile;
  if (!p) return { error: "Not authenticated." as const };
  const stations = (p.allowed_stations as string[]) ?? [];
  if (!isSupervisor(p.role) && !stations.includes(stage) && p.station !== stage) {
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
  return attachDimo(supabase, ((data as Row[]) ?? []).map(toUnit));
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
  if (!data) return null;
  return (await attachDimo(supabase, [toUnit(data as Row)]))[0];
}

/**
 * Resolve a unit waiting at `stage` by its carte serial OR its linked dimo.
 * From Binding onward every unit has a dimo, so post-Binding stations (Test, NG,
 * Reparation) accept whichever barcode the operator scans.
 */
export async function findUnitByCarteOrDimo(stage: WorkflowStage, code: string): Promise<Unit | null> {
  const c = code.trim();
  if (!c) return null;
  const bySerial = await findUnitByCode(stage, c);
  if (bySerial) return bySerial;
  const supabase = await createClient();
  const { data: link } = await supabase
    .from("carte_dimo_links")
    .select("carte_code")
    .eq("dimo_code", c)
    .maybeSingle();
  if (!link) return null;
  return findUnitByCode(stage, (link as { carte_code: string }).carte_code);
}

/**
 * Resolve a unit waiting at `stage` STRICTLY by its linked dimo barcode — the
 * carte serial is intentionally rejected. The Test station scans the dimo (the
 * product's physical label applied at Binding).
 */
export async function findUnitByDimo(stage: WorkflowStage, code: string): Promise<Unit | null> {
  const c = code.trim();
  if (!c) return null;
  const supabase = await createClient();
  const { data: link } = await supabase
    .from("carte_dimo_links")
    .select("carte_code")
    .eq("dimo_code", c)
    .maybeSingle();
  if (!link) return null;
  return findUnitByCode(stage, (link as { carte_code: string }).carte_code);
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

/**
 * Test: the operator scans the valid dimo (or carte serial) of a good product;
 * it advances to Reprint. Bad products are never scanned here — the NG operator
 * pulls them from this station via `sendToReparation`.
 */
export async function passTest(code: string): Promise<UnitResult> {
  const g = await guardStation("scan_test");
  if ("error" in g) return { error: g.error };
  // Test scans the DIMO barcode (the product's label after Binding), not the carte.
  const unit = await findUnitByDimo("scan_test", code);
  if (!unit) {
    // Scanned the carte serial instead of its dimo? Point the operator to the dimo.
    if (await findUnitByCode("scan_test", code)) return { reason: "use_dimo" };
    return { reason: "not_found" };
  }

  const target: WorkflowStage = "rescan_reprint";
  const admin = createAdminClient();
  await admin
    .from("pipeline_units")
    .update({ current_stage: target, test_result: "ok", problem_reason: null })
    .eq("id", unit.id);
  await auditScan(g.session!.userId, "scan_test", unit.serial, "ok");
  await notify(await operatorIdsAtStage(target), "box_arrived", null, unit.serial, undefined, target);
  return { ok: true, nextStage: target, serial: unit.serial, dimo: unit.dimo };
}

/**
 * NG: scan a bad product (currently at Test), record the problem, and send it to
 * Reparation. Accepts either the dimo or the carte serial.
 */
export async function sendToReparation(code: string, problem: string): Promise<UnitResult> {
  const g = await guardStation("ng_handling");
  if ("error" in g) return { error: g.error };
  if (!problem?.trim()) return { error: "A description is required." };
  const unit = await findUnitByCarteOrDimo("scan_test", code);
  if (!unit) return { reason: "not_found" };

  const target: WorkflowStage = "reparation";
  const admin = createAdminClient();
  await admin
    .from("pipeline_units")
    .update({ current_stage: target, test_result: "problem", problem_reason: problem.trim() })
    .eq("id", unit.id);
  await auditScan(g.session!.userId, "ng_handling", unit.serial, "fail");
  await notify(await operatorIdsAtStage(target), "box_arrived", null, unit.serial, undefined, target);
  return { ok: true, nextStage: target, serial: unit.serial, dimo: unit.dimo };
}

/** Reparation: the product is fixed → send it back to Test for re-testing. */
export async function finishReparation(id: string): Promise<UnitResult> {
  const unit = await loadUnit(id);
  if (unit?.current_stage !== "reparation") return { error: "Unit is not at the reparation step." };
  const g = await guardStation("reparation");
  if ("error" in g) return { error: g.error };

  const target: WorkflowStage = "scan_test";
  const admin = createAdminClient();
  await admin
    .from("pipeline_units")
    .update({ current_stage: target, test_result: null, problem_reason: null })
    .eq("id", id);
  await auditScan(g.session!.userId, "reparation", unit.serial, "ok", unit.otp_box_id);
  await notify(await operatorIdsAtStage(target), "box_arrived", null, unit.serial, undefined, target);
  return { ok: true, nextStage: target };
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

export interface LinkResult {
  ok?: boolean;
  error?: string;
  /** Localized by the client. */
  reason?: "carte_not_found" | "duplicate";
  nextStage?: WorkflowStage | null;
}

/**
 * Binding first scan: verify a carte is actually waiting at Binding BEFORE the
 * operator scans its dimo. Lets the UI flag a wrong serial (already passed this
 * step, or not yet arrived) on the first scan alone — the client resolves where
 * the code currently is via locateCode/notFoundMessage. `not_here` covers both.
 */
export async function checkCarteForBinding(carte: string): Promise<{ ok?: boolean; error?: string; reason?: "not_here" }> {
  const c = carte?.trim();
  if (!c) return { error: "Empty code." };
  const g = await guardStation("serial_linking");
  if ("error" in g) return { error: g.error };
  const unit = await findUnitByCode("serial_linking", c);
  return unit ? { ok: true } : { reason: "not_here" };
}

/**
 * Binding (serial_linking): relate a flowing carte (unit serial waiting here) to
 * a dimo barcode (one-to-one), then advance the unit. The link is persisted in
 * `carte_dimo_links` so an admin can look it up by either code.
 */
export async function linkCarteDimo(carteCode: string, dimoCode: string): Promise<LinkResult> {
  const carte = carteCode?.trim();
  const dimo = dimoCode?.trim();
  if (!carte || !dimo) return { error: "Both codes are required." };

  const g = await guardStation("serial_linking");
  if ("error" in g) return { error: g.error };

  // The carte must be a unit currently waiting at Binding.
  const unit = await findUnitByCode("serial_linking", carte);
  if (!unit) return { reason: "carte_not_found" };

  const supabase = await createClient();
  const { error: linkErr } = await supabase.from("carte_dimo_links").insert({
    carte_code: carte,
    dimo_code: dimo,
    unit_id: unit.id,
    created_by: g.session!.userId,
  });
  if (linkErr) {
    // Unique violation → this carte or dimo is already linked.
    if ((linkErr as { code?: string }).code === "23505") return { reason: "duplicate" };
    return { error: linkErr.message };
  }

  // Advance the unit to the next enabled stage, tagging the paired dimo in the audit log.
  const next = await nextEnabledStage("serial_linking");
  const admin = createAdminClient();
  await admin
    .from("pipeline_units")
    .update({ current_stage: next, status: next ? "active" : "done" })
    .eq("id", unit.id);
  await supabase.from("scan_events").insert({
    stage: "serial_linking",
    entity_type: "item",
    code: unit.serial,
    result: "ok",
    scanned_by: g.session!.userId,
    meta: { dimo },
  });
  if (next) await notify(await operatorIdsAtStage(next), "box_arrived", null, unit.serial, undefined, next);
  return { ok: true, nextStage: next };
}

export interface UnitLabel {
  serial: string;
  /** The dimo barcode — what the label encodes/prints post-Binding. */
  dimo: string | null;
  boxCode: string | null;
  product: string | null;
}

export async function getUnitLabel(id: string): Promise<UnitLabel | null> {
  const unit = await loadUnit(id);
  if (!unit) return null;
  const supabase = await createClient();
  const { data: link } = await supabase
    .from("carte_dimo_links")
    .select("dimo_code")
    .eq("carte_code", unit.serial)
    .maybeSingle();
  return {
    serial: unit.serial,
    dimo: (link as { dimo_code: string } | null)?.dimo_code ?? null,
    boxCode: unit.box_code,
    product: unit.product,
  };
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
