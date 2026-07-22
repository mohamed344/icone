"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getSessionUser } from "@/lib/auth/session";
import { notify, operatorIdsAtStage } from "@/lib/notify";
import { nextEnabledStage } from "@/lib/auth/steps";
import { FIRST_UNIT_STAGE, isSupervisor, type WorkflowStage } from "@/lib/workflow";
import type { QcBox } from "./qc1-actions";

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

/** Boxes currently waiting at `stage`. */
export async function getStageQueue(stage: WorkflowStage): Promise<QcBox[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("otp_boxes")
    .select("id, box_code, box_number, product, count, created_by, qc_reason")
    .eq("current_stage", stage)
    .order("qc_at", { ascending: true })
    .limit(100);
  return ((data as Row[]) ?? []).map(toBox);
}

/** Find a box waiting at `stage` by its scannable code. */
export async function findBoxAtStageByCode(stage: WorkflowStage, code: string): Promise<QcBox | null> {
  const c = code.trim();
  if (!c) return null;
  const supabase = await createClient();
  const { data } = await supabase
    .from("otp_boxes")
    .select("id, box_code, box_number, product, count, created_by, qc_reason")
    .eq("current_stage", stage)
    .eq("box_code", c)
    .maybeSingle();
  return data ? toBox(data as Row) : null;
}

export interface PassResult {
  ok?: boolean;
  error?: string;
  nextStage?: WorkflowStage | null;
}

/**
 * Receive a box at its current stage and pass it to the next enabled step.
 * Records one scan_event per member unit at the current stage, then advances
 * the box pointer and notifies the next station.
 */
export async function passBox(boxId: string): Promise<PassResult> {
  const session = await getSessionUser();
  const p = session?.profile;
  if (!p) return { error: "Not authenticated." };

  const supabase = await createClient();
  const { data: box } = await supabase
    .from("otp_boxes")
    .select("id, box_code, product, current_stage")
    .eq("id", boxId)
    .single();
  if (!box || !box.current_stage) return { error: "Box not found or not in a step." };

  const stage = box.current_stage as WorkflowStage;
  const stations = (p.allowed_stations as string[]) ?? [];
  if (!isSupervisor(p.role) && !stations.includes(stage) && p.station !== stage) {
    return { error: "This station is not assigned to you." };
  }

  // Member unit codes (linked at OTP time via meta.otp_box_id).
  const { data: members } = await supabase
    .from("scan_events")
    .select("code")
    .eq("stage", "otp_validation")
    .contains("meta", { otp_box_id: boxId });
  const codes = [...new Set(((members as { code: string }[]) ?? []).map((m) => m.code))];

  if (codes.length > 0) {
    const { error } = await supabase.from("scan_events").insert(
      codes.map((code) => ({
        stage,
        entity_type: "box",
        code,
        result: "ok",
        scanned_by: session!.userId,
        meta: { otp_box_id: boxId },
      })),
    );
    if (error) return { error: error.message };
  }

  const next = await nextEnabledStage(stage);
  const admin = createAdminClient();

  // Reception → step 5 dissolves the box into individually tracked products.
  if (stage === "reception" && next) {
    for (const serial of codes) {
      await admin
        .from("pipeline_units")
        .upsert(
          {
            serial,
            otp_box_id: boxId,
            box_code: box.box_code,
            product: box.product,
            current_stage: next,
            status: "active",
          },
          { onConflict: "serial" },
        );
    }
    await admin.from("otp_boxes").update({ current_stage: null }).eq("id", boxId);
    await notify(await operatorIdsAtStage(next), "box_arrived", boxId, box.box_code ?? "", undefined, next);
    return { ok: true, nextStage: next };
  }

  // Box-state write via service role (receiver is not the box creator).
  await admin.from("otp_boxes").update({ current_stage: next }).eq("id", boxId);

  if (next) {
    await notify(
      await operatorIdsAtStage(next),
      "box_arrived",
      boxId,
      box.box_code ?? "",
      undefined,
      next,
    );
  }

  return { ok: true, nextStage: next };
}
