"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getSessionUser } from "@/lib/auth/session";
import { notify, qc1OperatorIds, operatorIdsAtStage } from "@/lib/notify";
import { nextEnabledStage } from "@/lib/auth/steps";

export interface QcBox {
  id: string;
  boxCode: string | null;
  boxNumber: number;
  product: string | null;
  count: number;
  createdBy: string | null;
  reason?: string | null;
}

interface Row {
  id: string;
  box_code: string | null;
  box_number: number;
  product: string | null;
  count: number;
  created_by: string | null;
  qc_reason: string | null;
}

const toBox = (r: Row): QcBox => ({
  id: r.id,
  boxCode: r.box_code,
  boxNumber: r.box_number,
  product: r.product,
  count: r.count,
  createdBy: r.created_by,
  reason: r.qc_reason,
});

async function isQc1(role: string | undefined, stations: string[] | undefined) {
  return role === "admin" || (Array.isArray(stations) && stations.includes("qc1_box"));
}

/** Boxes awaiting QC#1 decision. */
export async function getQc1Queue(): Promise<QcBox[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("otp_boxes")
    .select("id, box_code, box_number, product, count, created_by, qc_reason")
    .eq("qc_state", "awaiting")
    .order("closed_at", { ascending: true })
    .limit(100);
  return ((data as Row[]) ?? []).map(toBox);
}

/** Find an awaiting box by its scannable code. */
export async function findAwaitingBoxByCode(code: string): Promise<QcBox | null> {
  const c = code.trim();
  if (!c) return null;
  const supabase = await createClient();
  const { data } = await supabase
    .from("otp_boxes")
    .select("id, box_code, box_number, product, count, created_by, qc_reason")
    .eq("qc_state", "awaiting")
    .eq("box_code", c)
    .maybeSingle();
  return data ? toBox(data as Row) : null;
}

export interface QcDecisionResult {
  ok?: boolean;
  error?: string;
}

/** QC#1 conform / non-conform decision for a whole box. */
export async function qc1Decision(
  boxId: string,
  decision: "conform" | "non_conform",
  reason?: string,
): Promise<QcDecisionResult> {
  const session = await getSessionUser();
  const p = session?.profile;
  if (!p || !(await isQc1(p.role, p.allowed_stations as string[]))) {
    return { error: "Only a Quality-1 operator can decide." };
  }
  if (decision === "non_conform" && !reason?.trim()) {
    return { error: "A description is required for non-conform." };
  }

  const supabase = await createClient();
  const { data: box } = await supabase
    .from("otp_boxes")
    .select("id, box_code, created_by, qc_state")
    .eq("id", boxId)
    .single();
  if (!box) return { error: "Box not found." };
  if (box.qc_state !== "awaiting") return { error: "This box was already decided." };

  const now = new Date().toISOString();
  // Box-state writes go through the service-role client: the QC operator is not
  // the box creator, and otp_boxes UPDATE RLS is restricted to the creator.
  const admin = createAdminClient();

  if (decision === "conform") {
    // Advance every unit of the box to qc1_box (batch scan_events).
    const { data: members } = await supabase
      .from("scan_events")
      .select("code")
      .eq("stage", "otp_validation")
      .contains("meta", { otp_box_id: boxId });
    const codes = [...new Set(((members as { code: string }[]) ?? []).map((m) => m.code))];
    if (codes.length > 0) {
      await supabase.from("scan_events").insert(
        codes.map((code) => ({
          stage: "qc1_box",
          entity_type: "box",
          code,
          result: "conform",
          scanned_by: session!.userId,
          meta: { otp_box_id: boxId },
        })),
      );
    }

    // Hand the box off to the next enabled step (reception).
    const next = await nextEnabledStage("qc1_box");
    await admin
      .from("otp_boxes")
      .update({ qc_state: "conform", qc_by: session!.userId, qc_at: now, current_stage: next })
      .eq("id", boxId);

    if (box.created_by) {
      await notify([box.created_by], "box_conform", boxId, box.box_code ?? "");
    }
    if (next) {
      await notify(await operatorIdsAtStage(next), "box_arrived", boxId, box.box_code ?? "", undefined, next);
    }
    return { ok: true };
  }

  // Non-conform → rework
  await admin
    .from("otp_boxes")
    .update({ qc_state: "rework", qc_reason: reason!.trim(), qc_by: session!.userId, qc_at: now, current_stage: null })
    .eq("id", boxId);

  // Log a rework record (best-effort; ignore FK issues on the unused domain table).
  await admin.from("rework_repairs").insert({
    kind: "rework",
    status: "open",
    reason: reason!.trim(),
    created_by: session!.userId,
  });

  if (box.created_by) {
    await notify([box.created_by], "box_rework", boxId, box.box_code ?? "", reason!.trim());
  }
  return { ok: true };
}

/** OTP operator's boxes that QC#1 sent to rework. */
export async function getReworkBoxes(): Promise<QcBox[]> {
  const session = await getSessionUser();
  if (!session?.profile) return [];
  const supabase = await createClient();
  const { data } = await supabase
    .from("otp_boxes")
    .select("id, box_code, box_number, product, count, created_by, qc_reason")
    .eq("qc_state", "rework")
    .eq("created_by", session.userId)
    .order("qc_at", { ascending: false })
    .limit(50);
  return ((data as Row[]) ?? []).map(toBox);
}

/** Operator re-submits a reworked box back to the QC#1 queue. */
export async function resubmitReworkBox(boxId: string): Promise<QcDecisionResult> {
  const session = await getSessionUser();
  if (!session?.profile) return { error: "Not authenticated." };
  const supabase = await createClient();

  const { data: box } = await supabase
    .from("otp_boxes")
    .select("id, box_code, created_by, qc_state")
    .eq("id", boxId)
    .single();
  if (!box || box.created_by !== session.userId) return { error: "Not allowed." };
  if (box.qc_state !== "rework") return { error: "Box is not in rework." };

  await supabase
    .from("otp_boxes")
    .update({ qc_state: "awaiting", qc_reason: null })
    .eq("id", boxId);

  const qcIds = await qc1OperatorIds();
  await notify(qcIds, "box_ready", boxId, box.box_code ?? "");
  return { ok: true };
}
