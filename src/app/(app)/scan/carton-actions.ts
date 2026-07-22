"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getSessionUser } from "@/lib/auth/session";
import { roleCan, userCan } from "@/lib/auth/permissions";
import { nextEnabledStage } from "@/lib/auth/steps";
import { notify, operatorIdsAtStage } from "@/lib/notify";
import { getLineConfig } from "./otp-actions";
import { isSupervisor, type WorkflowStage } from "@/lib/workflow";

type Admin = ReturnType<typeof createAdminClient>;
type Db = Awaited<ReturnType<typeof createClient>>;

// ---- shared guards / helpers ------------------------------------------------

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

async function nextCartonNumber(supabase: Awaited<ReturnType<typeof createClient>>) {
  const { data } = await supabase
    .from("pipeline_cartons")
    .select("carton_number")
    .order("carton_number", { ascending: false })
    .limit(1)
    .maybeSingle();
  return (data?.carton_number ?? 0) + 1;
}

/**
 * Close a carton: give it a scannable code, advance its cartes to QC#2, mark it
 * awaiting a QC#2 decision, and alert QC#2. Returns the code + member serials.
 */
async function closeCartonRow(admin: Admin, cartonId: string, cartonNumber: number) {
  const year = new Date().getFullYear();
  const code = `Icone-Carton${year}${String(cartonNumber).padStart(6, "0")}`;
  await admin
    .from("pipeline_cartons")
    .update({
      code,
      status: "closed",
      closed_at: new Date().toISOString(),
      current_stage: "qc2_final",
      qc2_state: "pending",
    })
    .eq("id", cartonId);
  await admin.from("pipeline_units").update({ current_stage: "qc2_final" }).eq("carton_id", cartonId);
  const { data: units } = await admin.from("pipeline_units").select("serial").eq("carton_id", cartonId);
  const serials = ((units as { serial: string }[]) ?? []).map((u) => u.serial);
  await notify(await operatorIdsAtStage("qc2_final"), "box_arrived", cartonId, code, undefined, "qc2_final");
  return { code, serials };
}

// ---- types ------------------------------------------------------------------

export interface CartonView {
  cartonNumber: number;
  count: number;
  target: number;
  model: string | null;
  code: string | null;
}

export interface CartonDone {
  id: string;
  cartonNumber: number;
  count: number;
  model: string | null;
  code: string | null;
}

export interface CartonLabelData {
  id: string;
  cartonNumber: number;
  code: string | null;
  model: string | null;
  count: number;
  serials: string[];
}

export interface CartonScanResult {
  ok?: boolean;
  error?: string;
  /** Localized by the client. */
  reason?: "not_found" | "already" | "unit_held";
  cartonClosed?: boolean;
  /** Carton reached its size but a product the operator took out is still not returned. */
  heldBlocked?: boolean;
  carton?: CartonView;
  label?: CartonLabelData;
}

export interface HeldUnit {
  id: string;
  serial: string;
  /** The unit's linked dimo barcode — its physical label, shown at Scan PF. */
  dimo: string | null;
  product: string | null;
  at: string;
}

// ---- reads ------------------------------------------------------------------

export interface ModelRef {
  id: string;
  reference: string;
  name: string;
}

/** Admin-defined product models (for the Scan PF model picker). */
export async function getModels(): Promise<ModelRef[]> {
  const supabase = await createClient();
  const { data } = await supabase.from("models").select("id, reference, name").order("reference");
  return (data as ModelRef[]) ?? [];
}

/** Cartes waiting at Scan PF that are not yet placed in a carton (held-out
 * products are excluded — they've left the pool until returned). */
export async function getCartonWaitingCount(): Promise<number> {
  const supabase = await createClient();
  const { count } = await supabase
    .from("pipeline_units")
    .select("id", { count: "exact", head: true })
    .eq("current_stage", "carton_printing")
    .eq("status", "active")
    .is("carton_id", null)
    .is("held_by", null);
  return count ?? 0;
}

/** True when this operator currently has any product taken out (held). */
async function operatorHasHeld(supabase: Db, userId: string): Promise<boolean> {
  const { count } = await supabase
    .from("pipeline_units")
    .select("id", { count: "exact", head: true })
    .eq("held_by", userId);
  return (count ?? 0) > 0;
}

/** The operator's current OPEN carton, or null. */
export async function getCurrentCarton(): Promise<CartonView | null> {
  const session = await getSessionUser();
  if (!session?.profile) return null;
  const supabase = await createClient();
  const { cartonSize } = await getLineConfig();
  const { data } = await supabase
    .from("pipeline_cartons")
    .select("carton_number, count, model, code")
    .eq("created_by", session.userId)
    .eq("status", "open")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!data) return null;
  return { cartonNumber: data.carton_number, count: data.count, target: cartonSize, model: data.model, code: data.code };
}

/** The operator's recently closed cartons (newest first). */
export async function getRecentCartons(limit = 20): Promise<CartonDone[]> {
  const session = await getSessionUser();
  if (!session?.profile) return [];
  const supabase = await createClient();
  const { data } = await supabase
    .from("pipeline_cartons")
    .select("id, carton_number, count, model, code, closed_at")
    .eq("created_by", session.userId)
    .eq("status", "closed")
    .order("closed_at", { ascending: false })
    .limit(limit);
  return ((data as { id: string; carton_number: number; count: number; model: string | null; code: string | null }[]) ?? []).map(
    (c) => ({ id: c.id, cartonNumber: c.carton_number, count: c.count, model: c.model, code: c.code }),
  );
}

/** Full label payload for a carton (serials grid), used for (re)printing. */
export async function getCartonLabel(cartonId: string): Promise<CartonLabelData | null> {
  const supabase = await createClient();
  const { data: c } = await supabase
    .from("pipeline_cartons")
    .select("id, carton_number, code, model, count")
    .eq("id", cartonId)
    .single();
  if (!c) return null;
  const { data: units } = await supabase.from("pipeline_units").select("serial").eq("carton_id", cartonId);
  return {
    id: c.id,
    cartonNumber: c.carton_number,
    code: c.code,
    model: c.model,
    count: c.count,
    serials: ((units as { serial: string }[]) ?? []).map((u) => u.serial),
  };
}

// ---- Scan PF (step 9): accumulate cartes into a carton ----------------------

/**
 * Record a carte into the operator's current carton. Opens a carton on the
 * first scan (with `model`); a different model starts a new carton. Closes and
 * prints automatically at the configured carton size.
 */
export async function recordCartonScan(serial: string, model?: string): Promise<CartonScanResult> {
  const s = serial?.trim();
  if (!s) return { error: "Empty code." };

  const g = await guardStation("carton_printing");
  if ("error" in g) return { error: g.error };
  const session = g.session!;

  const supabase = await createClient();
  const admin = createAdminClient();

  // The carte must be waiting at Scan PF and not already in a carton or held out.
  // Operators scan the dimo (the physical label) here, so accept either the carte
  // serial or its linked dimo — consistent with every other post-Binding station.
  const unitCols = "id, carton_id, held_by";
  let { data: unit } = await supabase
    .from("pipeline_units")
    .select(unitCols)
    .eq("serial", s)
    .eq("current_stage", "carton_printing")
    .eq("status", "active")
    .maybeSingle();
  if (!unit) {
    const { data: link } = await supabase
      .from("carte_dimo_links")
      .select("carte_code")
      .eq("dimo_code", s)
      .maybeSingle();
    if (link) {
      ({ data: unit } = await supabase
        .from("pipeline_units")
        .select(unitCols)
        .eq("serial", (link as { carte_code: string }).carte_code)
        .eq("current_stage", "carton_printing")
        .eq("status", "active")
        .maybeSingle());
    }
  }
  if (!unit) return { reason: "not_found" };
  if (unit.carton_id) return { reason: "already" };
  if (unit.held_by) return { reason: "unit_held" };

  const { cartonSize } = await getLineConfig();
  const mdl = model?.trim() || null;
  // While this operator has a product taken out, their carton cannot close.
  const hasHeld = await operatorHasHeld(supabase, session.userId);

  const { data: openC } = await supabase
    .from("pipeline_cartons")
    .select("id, carton_number, model, count")
    .eq("created_by", session.userId)
    .eq("status", "open")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  let carton = openC as { id: string; carton_number: number; model: string | null; count: number } | null;

  // Carton already at size but couldn't close (a product is still out): don't
  // over-fill — the operator must return it first.
  if (carton && carton.count >= cartonSize) {
    return { heldBlocked: true };
  }

  // A different model closes the current carton and opens a new one.
  if (carton && mdl && carton.model && carton.model !== mdl) {
    await closeCartonRow(admin, carton.id, carton.carton_number);
    carton = null;
  }

  if (!carton) {
    const number = await nextCartonNumber(supabase);
    const { data: created, error } = await admin
      .from("pipeline_cartons")
      .insert({
        carton_number: number,
        model: mdl,
        count: 0,
        status: "open",
        current_stage: "carton_printing",
        created_by: session.userId,
      })
      .select("id, carton_number, model, count")
      .single();
    if (error) return { error: error.message };
    carton = created as { id: string; carton_number: number; model: string | null; count: number };
  }

  await admin.from("pipeline_units").update({ carton_id: carton.id }).eq("id", unit.id);
  const newCount = carton.count + 1;
  const modelToSet = carton.model ?? mdl;
  const reachedSize = newCount >= cartonSize;
  // Full carton closes only if the operator has no product still out.
  const willClose = reachedSize && !hasHeld;

  await admin.from("pipeline_cartons").update({ count: newCount, model: modelToSet }).eq("id", carton.id);

  let code: string | null = null;
  let serials: string[] = [];
  if (willClose) {
    const res = await closeCartonRow(admin, carton.id, carton.carton_number);
    code = res.code;
    serials = res.serials;
  }

  return {
    ok: true,
    cartonClosed: willClose,
    heldBlocked: reachedSize && hasHeld,
    carton: { cartonNumber: carton.carton_number, count: newCount, target: cartonSize, model: modelToSet, code },
    label: willClose
      ? { id: carton.id, cartonNumber: carton.carton_number, code, model: modelToSet, count: newCount, serials }
      : undefined,
  };
}

/** Manually close the operator's current (partial) carton. */
export async function closeCartonManually(): Promise<{ ok?: boolean; error?: string; reason?: "held"; label?: CartonLabelData }> {
  const g = await guardStation("carton_printing");
  if ("error" in g) return { error: g.error };
  const session = g.session!;
  const supabase = await createClient();
  const admin = createAdminClient();

  // A carton cannot pass to QC#2 while the operator still has a product out.
  if (await operatorHasHeld(supabase, session.userId)) return { reason: "held" };

  const { data: openC } = await supabase
    .from("pipeline_cartons")
    .select("id, carton_number, model, count")
    .eq("created_by", session.userId)
    .eq("status", "open")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!openC) return { ok: true };
  if (openC.count === 0) {
    await admin.from("pipeline_cartons").update({ status: "closed", closed_at: new Date().toISOString() }).eq("id", openC.id);
    return { ok: true };
  }

  const { code, serials } = await closeCartonRow(admin, openC.id, openC.carton_number);
  return {
    ok: true,
    label: { id: openC.id, cartonNumber: openC.carton_number, code, model: openC.model, count: openC.count, serials },
  };
}

// ---- Scan PF: take one product out / return it -----------------------------

interface HoldUnitRow {
  id: string;
  serial: string;
  product: string | null;
  carton_id: string | null;
  held_by: string | null;
  status: string;
}

/** Resolve a waiting product at Scan PF from its DIMO barcode. */
async function unitByDimoAtCartonPrinting(supabase: Db, dimo: string): Promise<HoldUnitRow | null> {
  const { data: link } = await supabase
    .from("carte_dimo_links")
    .select("carte_code")
    .eq("dimo_code", dimo)
    .maybeSingle();
  if (!link) return null;
  const { data: unit } = await supabase
    .from("pipeline_units")
    .select("id, serial, product, carton_id, held_by, status")
    .eq("serial", (link as { carte_code: string }).carte_code)
    .eq("current_stage", "carton_printing")
    .maybeSingle();
  return (unit as HoldUnitRow) ?? null;
}

export interface HoldResult {
  ok?: boolean;
  error?: string;
  /** Localized by the client. */
  reason?: "not_found" | "in_carton" | "already_out" | "not_out";
  serial?: string;
  /** The scanned dimo barcode — shown in confirmations at Scan PF. */
  dimo?: string | null;
}

/**
 * Take a waiting product out of the cartoning pool (scan its DIMO). Records the
 * logged-in operator as the holder; the product leaves the pool and the
 * operator's open carton can't advance until it is returned.
 */
export async function takeUnitOut(dimo: string): Promise<HoldResult> {
  const g = await guardStation("carton_printing");
  if ("error" in g) return { error: g.error };
  const session = g.session!;
  const d = dimo?.trim();
  if (!d) return { error: "Empty code." };

  const supabase = await createClient();
  const admin = createAdminClient();
  const unit = await unitByDimoAtCartonPrinting(supabase, d);
  if (!unit || unit.status !== "active") return { reason: "not_found" };
  if (unit.carton_id) return { reason: "in_carton" };
  if (unit.held_by) return { reason: "already_out" };

  await admin.from("pipeline_units").update({ held_by: session.userId }).eq("id", unit.id);
  await admin.from("unit_movements").insert({ unit_id: unit.id, action: "take", by_user: session.userId });
  return { ok: true, serial: unit.serial, dimo: d };
}

/** Return a held product to the pool (scan its DIMO again). */
export async function returnUnit(dimo: string): Promise<HoldResult> {
  const g = await guardStation("carton_printing");
  if ("error" in g) return { error: g.error };
  const session = g.session!;
  const d = dimo?.trim();
  if (!d) return { error: "Empty code." };

  const supabase = await createClient();
  const admin = createAdminClient();
  const unit = await unitByDimoAtCartonPrinting(supabase, d);
  if (!unit) return { reason: "not_found" };
  if (!unit.held_by) return { reason: "not_out" };

  await admin.from("pipeline_units").update({ held_by: null }).eq("id", unit.id);
  await admin.from("unit_movements").insert({ unit_id: unit.id, action: "return", by_user: session.userId });
  return { ok: true, serial: unit.serial, dimo: d };
}

/** Products the current operator currently has taken out. */
export async function getHeldUnits(): Promise<HeldUnit[]> {
  const session = await getSessionUser();
  if (!session?.profile) return [];
  const supabase = await createClient();
  const { data } = await supabase
    .from("pipeline_units")
    .select("id, serial, product, updated_at")
    .eq("held_by", session.userId)
    .order("updated_at", { ascending: false })
    .limit(50);
  const rows = (data as { id: string; serial: string; product: string | null; updated_at: string }[]) ?? [];

  // Resolve each unit's dimo — its physical label, shown instead of the carte serial.
  const { data: links } = await supabase
    .from("carte_dimo_links")
    .select("carte_code, dimo_code")
    .in("carte_code", rows.map((u) => u.serial));
  const byCarte = new Map(
    ((links as { carte_code: string; dimo_code: string }[]) ?? []).map((l) => [l.carte_code, l.dimo_code]),
  );

  return rows.map((u) => ({
    id: u.id,
    serial: u.serial,
    dimo: byCarte.get(u.serial) ?? null,
    product: u.product,
    at: u.updated_at,
  }));
}

// ============================================================================
// Qualité 2 (step 10): approve / reject a carton, + take / return audit
// ============================================================================

export interface QcCarton {
  id: string;
  cartonNumber: number;
  code: string | null;
  model: string | null;
  count: number;
  qc2State: string | null;
  qc2Reason: string | null;
  currentStage: WorkflowStage | null;
}

const toQcCarton = (c: {
  id: string;
  carton_number: number;
  code: string | null;
  model: string | null;
  count: number;
  qc2_state: string | null;
  qc2_reason: string | null;
  current_stage: WorkflowStage | null;
}): QcCarton => ({
  id: c.id,
  cartonNumber: c.carton_number,
  code: c.code,
  model: c.model,
  count: c.count,
  qc2State: c.qc2_state,
  qc2Reason: c.qc2_reason,
  currentStage: c.current_stage,
});

const QC_CARTON_COLS = "id, carton_number, code, model, count, qc2_state, qc2_reason, current_stage";

/** Cartons awaiting a QC#2 decision. */
export async function getQc2Queue(): Promise<QcCarton[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("pipeline_cartons")
    .select(QC_CARTON_COLS)
    .eq("current_stage", "qc2_final")
    .eq("qc2_state", "pending")
    .order("closed_at", { ascending: true })
    .limit(100);
  return ((data as Parameters<typeof toQcCarton>[0][]) ?? []).map(toQcCarton);
}

/** Find a carton awaiting QC#2 by its scannable code. */
export async function findCartonByCode(code: string): Promise<QcCarton | null> {
  const c = code.trim();
  if (!c) return null;
  const supabase = await createClient();
  const { data } = await supabase
    .from("pipeline_cartons")
    .select(QC_CARTON_COLS)
    .eq("code", c)
    .maybeSingle();
  return data ? toQcCarton(data as Parameters<typeof toQcCarton>[0]) : null;
}

async function nextPalletNumber(supabase: Db) {
  const { data } = await supabase
    .from("pipeline_pallets")
    .select("pallet_number")
    .order("pallet_number", { ascending: false })
    .limit(1)
    .maybeSingle();
  return (data?.pallet_number ?? 0) + 1;
}

/** Add an approved carton to the current open pallet; auto-close it at size. */
async function addCartonToPallet(admin: Admin, supabase: Db, cartonId: string, byUserId: string) {
  const { palletSize } = await getLineConfig();
  let pallet = (
    await supabase
      .from("pipeline_pallets")
      .select("id, pallet_number, count")
      .eq("status", "open")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle()
  ).data as { id: string; pallet_number: number; count: number } | null;

  if (!pallet) {
    const number = await nextPalletNumber(supabase);
    const { data: created } = await admin
      .from("pipeline_pallets")
      .insert({ pallet_number: number, count: 0, status: "open", created_by: byUserId })
      .select("id, pallet_number, count")
      .single();
    pallet = created as { id: string; pallet_number: number; count: number };
  }

  const newCount = pallet.count + 1;
  const willClose = newCount >= palletSize;
  await admin.from("pipeline_cartons").update({ pallet_id: pallet.id }).eq("id", cartonId);

  const patch: Record<string, unknown> = { count: newCount };
  if (willClose) {
    const year = new Date().getFullYear();
    patch.status = "closed";
    patch.closed_at = new Date().toISOString();
    patch.code = `Icone-Palette${year}${String(pallet.pallet_number).padStart(6, "0")}`;
  }
  await admin.from("pipeline_pallets").update(patch).eq("id", pallet.id);
}

/** Apply an approve/reject decision to a carton (shared by operator + chef). */
async function applyQc2Decision(
  admin: Admin,
  supabase: Db,
  carton: { id: string; pallet_id: string | null },
  decision: "approved" | "rejected",
  reason: string | null,
  byUserId: string,
  isOverride: boolean,
) {
  const now = new Date().toISOString();
  const patch: Record<string, unknown> = {
    qc2_state: decision,
    qc2_reason: decision === "rejected" ? reason : null,
  };
  if (isOverride) {
    patch.overridden_by = byUserId;
    patch.overridden_at = now;
  } else {
    patch.qc2_by = byUserId;
    patch.qc2_at = now;
  }

  if (decision === "approved") {
    const next = await nextEnabledStage("qc2_final"); // stock_entry
    patch.current_stage = next;
    await admin.from("pipeline_cartons").update(patch).eq("id", carton.id);
    await admin.from("pipeline_units").update({ current_stage: next }).eq("carton_id", carton.id);
    await addCartonToPallet(admin, supabase, carton.id, byUserId);
    if (next) await notify(await operatorIdsAtStage(next), "box_arrived", carton.id, "", undefined, next);
  } else {
    // Rejected → hold at QC#2 and detach from any pallet it had joined.
    patch.current_stage = "qc2_final";
    patch.pallet_id = null;
    await admin.from("pipeline_cartons").update(patch).eq("id", carton.id);
    await admin.from("pipeline_units").update({ current_stage: "qc2_final" }).eq("carton_id", carton.id);
    if (carton.pallet_id) {
      const { data: p } = await admin.from("pipeline_pallets").select("count").eq("id", carton.pallet_id).single();
      await admin
        .from("pipeline_pallets")
        .update({ count: Math.max(0, (p?.count ?? 1) - 1) })
        .eq("id", carton.pallet_id);
    }
  }
}

export interface Qc2Result {
  ok?: boolean;
  error?: string;
}

/** QC#2 operator approves / rejects a carton (reason required on reject). */
export async function qc2Decision(cartonId: string, decision: "approved" | "rejected", reason?: string): Promise<Qc2Result> {
  const g = await guardStation("qc2_final");
  if ("error" in g) return { error: g.error };
  const session = g.session!;
  if (decision === "rejected" && !reason?.trim()) return { error: "A description is required to reject." };

  const supabase = await createClient();
  const admin = createAdminClient();
  const { data: carton } = await supabase
    .from("pipeline_cartons")
    .select("id, pallet_id, qc2_state")
    .eq("id", cartonId)
    .single();
  if (!carton) return { error: "Carton not found." };
  if (carton.qc2_state && carton.qc2_state !== "pending") return { error: "This carton was already decided." };

  await applyQc2Decision(admin, supabase, carton, decision, reason?.trim() ?? null, session.userId, false);
  return { ok: true };
}

/** Chef de ligne overrides a carton's QC#2 decision. */
export async function overrideCartonQc2(
  cartonId: string,
  decision: "approved" | "rejected",
  reason: string,
): Promise<Qc2Result> {
  const session = await getSessionUser();
  const role = session?.profile?.role;
  if (!role || !(await roleCan(role, "override_qc"))) {
    return { error: "You don't have permission to override QC decisions." };
  }
  if (decision === "rejected" && !reason.trim()) return { error: "A reason is required to reject." };

  const supabase = await createClient();
  const admin = createAdminClient();
  const { data: carton } = await supabase
    .from("pipeline_cartons")
    .select("id, pallet_id, qc2_state")
    .eq("id", cartonId)
    .single();
  if (!carton) return { error: "Carton not found." };

  // Re-approving a REJECTED carton is restricted (admin-only unless delegated).
  if (carton.qc2_state === "rejected" && decision === "approved" && !(await userCan(session!.profile, "approve_rejected"))) {
    return { error: "Only an administrator (or a delegated user) can approve a rejected carton." };
  }

  await applyQc2Decision(admin, supabase, carton, decision, reason.trim() || null, session!.userId, true);
  return { ok: true };
}

/** Rejected cartons, for the admin re-approval screen (newest first). */
export async function getRejectedCartons(limit = 60): Promise<QcCarton[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("pipeline_cartons")
    .select(QC_CARTON_COLS)
    .eq("qc2_state", "rejected")
    .order("qc2_at", { ascending: false })
    .limit(limit);
  return ((data as Parameters<typeof toQcCarton>[0][]) ?? []).map(toQcCarton);
}

/**
 * Approve a previously-rejected carton. Restricted to admins and users the
 * admin has granted the `approve_rejected` permission.
 */
export async function approveRejectedCarton(cartonId: string): Promise<Qc2Result> {
  const session = await getSessionUser();
  if (!(await userCan(session?.profile, "approve_rejected"))) {
    return { error: "Only an administrator (or a delegated user) can approve a rejected carton." };
  }

  const supabase = await createClient();
  const admin = createAdminClient();
  const { data: carton } = await supabase
    .from("pipeline_cartons")
    .select("id, pallet_id, qc2_state")
    .eq("id", cartonId)
    .single();
  if (!carton) return { error: "Carton not found." };
  if (carton.qc2_state !== "rejected") return { error: "This carton is not rejected." };

  await applyQc2Decision(admin, supabase, carton, "approved", null, session!.userId, true);
  return { ok: true };
}

/**
 * Cartons that still need the chef's attention at QC#2 (newest first): those
 * awaiting a decision (`pending`) or rejected (to override). Approved cartons
 * are finalized and drop off the panel — they can't be re-approved.
 */
export async function getChefCartons(limit = 30): Promise<QcCarton[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("pipeline_cartons")
    .select(QC_CARTON_COLS)
    .in("qc2_state", ["pending", "rejected"])
    .order("closed_at", { ascending: false })
    .limit(limit);
  return ((data as Parameters<typeof toQcCarton>[0][]) ?? []).map(toQcCarton);
}

export interface Qc2HistoryCarton extends QcCarton {
  /** Pallet the carton joined after approval (null for rejected / unassigned). */
  palletCode: string | null;
  decidedAt: string | null;
}

/** Recently decided cartons (approved or rejected) for the QC#2 history panel. */
export async function getQc2History(limit = 40): Promise<Qc2HistoryCarton[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("pipeline_cartons")
    .select(QC_CARTON_COLS + ", qc2_at, pallet_id")
    .in("qc2_state", ["approved", "rejected"])
    .order("qc2_at", { ascending: false })
    .limit(limit);
  const rows =
    (data as unknown as (Parameters<typeof toQcCarton>[0] & { qc2_at: string | null; pallet_id: string | null })[]) ?? [];

  const palletIds = [...new Set(rows.map((r) => r.pallet_id).filter(Boolean))] as string[];
  let palletById = new Map<string, string | null>();
  if (palletIds.length) {
    const { data: pallets } = await supabase.from("pipeline_pallets").select("id, code").in("id", palletIds);
    palletById = new Map(((pallets as { id: string; code: string | null }[]) ?? []).map((p) => [p.id, p.code]));
  }

  return rows.map((r) => ({
    ...toQcCarton(r),
    palletCode: r.pallet_id ? (palletById.get(r.pallet_id) ?? null) : null,
    decidedAt: r.qc2_at,
  }));
}

export interface PalletLabelData {
  id: string;
  palletNumber: number;
  code: string | null;
  /** Each member carton's scannable code (its own barcode). */
  cartonCodes: string[];
}

/** Full label payload for a pallet (its carton codes grid), used for printing. */
export async function getPalletLabel(palletId: string): Promise<PalletLabelData | null> {
  const supabase = await createClient();
  const { data: p } = await supabase
    .from("pipeline_pallets")
    .select("id, pallet_number, code")
    .eq("id", palletId)
    .single();
  if (!p) return null;
  const { data: cartons } = await supabase
    .from("pipeline_cartons")
    .select("code")
    .eq("pallet_id", palletId)
    .order("carton_number");
  return {
    id: p.id,
    palletNumber: p.pallet_number,
    code: p.code,
    cartonCodes: ((cartons as { code: string | null }[]) ?? []).map((c) => c.code).filter(Boolean) as string[],
  };
}

// ---- take / return audit ----------------------------------------------------

export interface Movement {
  id: string;
  cartonCode: string | null;
  cartonNumber: number | null;
  action: "take" | "return";
  who: string;
  at: string;
}

async function recordMovement(action: "take" | "return", code: string): Promise<{ ok?: boolean; error?: string }> {
  const g = await guardStation("qc2_final");
  if ("error" in g) return { error: g.error };
  const session = g.session!;
  const c = code.trim();
  if (!c) return { error: "Empty code." };

  const supabase = await createClient();
  const admin = createAdminClient();
  const { data: carton } = await supabase.from("pipeline_cartons").select("id").eq("code", c).maybeSingle();
  if (!carton) return { error: "Carton not found." };

  // Enforce alternation: can't take an already-taken carton, or return a present one.
  const { data: last } = await supabase
    .from("carton_movements")
    .select("action")
    .eq("carton_id", carton.id)
    .order("at", { ascending: false })
    .limit(1)
    .maybeSingle();
  const isOut = last?.action === "take";
  if (action === "take" && isOut) return { error: "This carton is already taken out." };
  if (action === "return" && !isOut) return { error: "This carton is not currently taken out." };

  const { error } = await admin
    .from("carton_movements")
    .insert({ carton_id: carton.id, action, by_user: session.userId });
  if (error) return { error: error.message };
  return { ok: true };
}

export async function takeCarton(code: string) {
  return recordMovement("take", code);
}
export async function returnCarton(code: string) {
  return recordMovement("return", code);
}

// ============================================================================
// Stock (step 11): receive by pallet OR carton -> products enter stock
// ============================================================================

export interface StockDone {
  id: string;
  code: string | null;
  model: string | null;
  count: number;
}

export interface StockEntryResult {
  ok?: boolean;
  error?: string;
  reason?: "not_found" | "already";
  kind?: "pallet" | "carton";
  count?: number;
  code?: string | null;
}

/** Cartons approved and waiting to enter stock. */
export async function getStockWaitingCount(): Promise<number> {
  const supabase = await createClient();
  const { count } = await supabase
    .from("pipeline_cartons")
    .select("id", { count: "exact", head: true })
    .eq("current_stage", "stock_entry")
    .eq("stock_entered", false);
  return count ?? 0;
}

/** Recently stocked cartons (newest first). */
export async function getRecentStockCartons(limit = 20): Promise<StockDone[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("pipeline_cartons")
    .select("id, code, model, count, closed_at")
    .eq("stock_entered", true)
    .order("closed_at", { ascending: false })
    .limit(limit);
  return ((data as { id: string; code: string | null; model: string | null; count: number }[]) ?? []).map((c) => ({
    id: c.id,
    code: c.code,
    model: c.model,
    count: c.count,
  }));
}

/** Move one carton's cartes into stock (units done + audit scan_events). */
async function enterCartonToStock(admin: Admin, supabase: Db, cartonId: string, byUserId: string): Promise<number> {
  const { data: units } = await supabase
    .from("pipeline_units")
    .select("serial")
    .eq("carton_id", cartonId)
    .eq("status", "active");
  const list = (units as { serial: string }[]) ?? [];
  if (list.length) {
    await admin.from("pipeline_units").update({ status: "done", current_stage: null }).eq("carton_id", cartonId).eq("status", "active");
    await admin.from("scan_events").insert(
      list.map((u) => ({
        stage: "stock_entry",
        entity_type: "item",
        code: u.serial,
        result: "ok",
        scanned_by: byUserId,
        meta: { carton_id: cartonId },
      })),
    );
  }
  await admin.from("pipeline_cartons").update({ stock_entered: true, current_stage: null }).eq("id", cartonId);
  return list.length;
}

/** Enter stock by scanning a PALLET code (all its cartons) or a CARTON code. */
export async function stockEntry(code: string): Promise<StockEntryResult> {
  const g = await guardStation("stock_entry");
  if ("error" in g) return { error: g.error };
  const session = g.session!;
  const c = code.trim();
  if (!c) return { error: "Empty code." };

  const supabase = await createClient();
  const admin = createAdminClient();

  // Pallet code → enter every not-yet-stocked carton in it.
  const { data: pallet } = await supabase.from("pipeline_pallets").select("id, code").eq("code", c).maybeSingle();
  if (pallet) {
    const { data: cartons } = await supabase
      .from("pipeline_cartons")
      .select("id")
      .eq("pallet_id", pallet.id)
      .eq("stock_entered", false);
    let total = 0;
    for (const ct of (cartons as { id: string }[]) ?? []) {
      total += await enterCartonToStock(admin, supabase, ct.id, session.userId);
    }
    await admin
      .from("pipeline_pallets")
      .update({ stock_entered: true, stock_entered_at: new Date().toISOString(), status: "closed" })
      .eq("id", pallet.id);
    return { ok: true, kind: "pallet", count: total, code: pallet.code };
  }

  // Carton code.
  const { data: carton } = await supabase
    .from("pipeline_cartons")
    .select("id, code, stock_entered")
    .eq("code", c)
    .maybeSingle();
  if (!carton) return { reason: "not_found" };
  if (carton.stock_entered) return { reason: "already" };
  const count = await enterCartonToStock(admin, supabase, carton.id, session.userId);
  return { ok: true, kind: "carton", count, code: carton.code };
}

/** Recent take/return movements (newest first) with carton code + who. */
export async function getCartonMovements(limit = 40): Promise<Movement[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("carton_movements")
    .select("id, action, at, by_user, carton_id")
    .order("at", { ascending: false })
    .limit(limit);
  const rows = (data as { id: string; action: "take" | "return"; at: string; by_user: string | null; carton_id: string | null }[]) ?? [];
  if (rows.length === 0) return [];

  const cartonIds = [...new Set(rows.map((r) => r.carton_id).filter(Boolean))] as string[];
  const userIds = [...new Set(rows.map((r) => r.by_user).filter(Boolean))] as string[];
  const [cartonsRes, profsRes] = await Promise.all([
    supabase.from("pipeline_cartons").select("id, code, carton_number").in("id", cartonIds.length ? cartonIds : ["00000000-0000-0000-0000-000000000000"]),
    supabase.from("profiles").select("id, full_name").in("id", userIds.length ? userIds : ["00000000-0000-0000-0000-000000000000"]),
  ]);
  const cartonById = new Map(
    ((cartonsRes.data as { id: string; code: string | null; carton_number: number }[]) ?? []).map((c) => [c.id, c]),
  );
  const nameById = new Map(((profsRes.data as { id: string; full_name: string | null }[]) ?? []).map((p) => [p.id, p.full_name ?? "—"]));

  return rows.map((r) => {
    const c = r.carton_id ? cartonById.get(r.carton_id) : undefined;
    return {
      id: r.id,
      cartonCode: c?.code ?? null,
      cartonNumber: c?.carton_number ?? null,
      action: r.action,
      who: r.by_user ? (nameById.get(r.by_user) ?? "—") : "—",
      at: r.at,
    };
  });
}
