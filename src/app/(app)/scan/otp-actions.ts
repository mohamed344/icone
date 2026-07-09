"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getSessionUser, type WorkflowStage } from "@/lib/auth/session";
import { recordScan } from "./actions";
import { notify, qc1OperatorIds } from "@/lib/notify";

/** Close a box, give it a scannable code, mark it awaiting QC#1, and alert QC. */
async function sendBoxToQc(
  supabase: Awaited<ReturnType<typeof createClient>>,
  box: { id: string; box_number: number },
) {
  const boxCode = `BX-${box.box_number}-${box.id.slice(0, 6).toUpperCase()}`;
  await supabase
    .from("otp_boxes")
    .update({ box_code: boxCode, qc_state: "awaiting" })
    .eq("id", box.id);
  const qcIds = await qc1OperatorIds();
  await notify(qcIds, "box_ready", box.id, boxCode);
}

export type OtpMode = "count" | "product";

export interface OtpConfig {
  mode: OtpMode;
  size: number;
}

export interface OtpBoxView {
  boxNumber: number;
  count: number;
  target: number | null;
  product: string | null;
}

export interface OtpScanResult {
  ok?: boolean;
  error?: string;
  reason?: "out_of_order" | "step_off" | "completed";
  expectedStage?: WorkflowStage;
  nextStage?: WorkflowStage | null;
  /** The box the unit went into (its state after this scan). */
  box?: OtpBoxView;
  /** True when this scan filled/finished the box (it is now closed). */
  boxClosed?: boolean;
}

/** Read the OTP box configuration (admin-managed, singleton). */
export async function getOtpConfig(): Promise<OtpConfig> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("app_config")
    .select("otp_box_mode, otp_box_size")
    .eq("id", true)
    .single();
  const mode = (data?.otp_box_mode as OtpMode) ?? "count";
  const size = data?.otp_box_size ?? 70;
  return { mode, size };
}

/** The operator's current OPEN box (persists across sessions/days), or null. */
export async function getCurrentOtpBox(): Promise<OtpBoxView | null> {
  const session = await getSessionUser();
  if (!session?.profile) return null;
  const supabase = await createClient();
  const { data } = await supabase
    .from("otp_boxes")
    .select("box_number, count, target, product")
    .eq("created_by", session.userId)
    .eq("status", "open")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!data) return null;
  return {
    boxNumber: data.box_number,
    count: data.count,
    target: data.target,
    product: data.product,
  };
}

async function nextBoxNumber(supabase: Awaited<ReturnType<typeof createClient>>, userId: string) {
  const { data } = await supabase
    .from("otp_boxes")
    .select("box_number")
    .eq("created_by", userId)
    .order("box_number", { ascending: false })
    .limit(1)
    .maybeSingle();
  return (data?.box_number ?? 0) + 1;
}

/**
 * Record an OTP scan and place the unit into the current box.
 * - First runs the normal sequential scan (must have passed Scan BF).
 * - Then adds it to the open box; auto-closes + opens the next when complete.
 */
export async function recordOtpScan(code: string, product?: string): Promise<OtpScanResult> {
  const trimmed = code?.trim();
  if (!trimmed) return { error: "Empty code." };

  const session = await getSessionUser();
  if (!session?.profile) return { error: "Not authenticated." };

  // 1) Normal sequential scan (records scan_events, advances the unit).
  const scan = await recordScan({ stage: "otp_validation", code: trimmed, entityType: "container" });
  if (scan.error || scan.reason) {
    return {
      error: scan.error,
      reason: scan.reason,
      expectedStage: scan.expectedStage,
    };
  }

  // 2) Box accounting.
  const cfg = await getOtpConfig();
  const supabase = await createClient();
  const userId = session.userId;
  const prod = product?.trim() || null;

  // Current open box for this operator.
  const { data: openBox } = await supabase
    .from("otp_boxes")
    .select("id, box_number, mode, target, product, count, status")
    .eq("created_by", userId)
    .eq("status", "open")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  type Box = {
    id: string;
    box_number: number;
    mode: string;
    target: number | null;
    product: string | null;
    count: number;
    status: string;
  };
  let box = (openBox as Box | null) ?? null;

  // Product mode: a different product closes the current box and opens a new one.
  if (box && cfg.mode === "product" && prod && box.product && box.product !== prod) {
    await supabase
      .from("otp_boxes")
      .update({ status: "closed", closed_at: new Date().toISOString() })
      .eq("id", box.id);
    await sendBoxToQc(supabase, box);
    box = null;
  }

  // Open a fresh box if needed.
  if (!box) {
    const box_number = await nextBoxNumber(supabase, userId);
    const { data: created, error } = await supabase
      .from("otp_boxes")
      .insert({
        box_number,
        mode: cfg.mode,
        target: cfg.mode === "count" ? cfg.size : null,
        product: prod,
        count: 0,
        status: "open",
        created_by: userId,
      })
      .select("id, box_number, mode, target, product, count, status")
      .single();
    if (error) return { error: error.message };
    box = created as Box;
  }

  const newCount = box!.count + 1;
  // Set the product on first item if not yet set (product mode).
  const productToSet = box!.product ?? (cfg.mode === "product" ? prod : null);
  const willClose = cfg.mode === "count" && box!.target != null && newCount >= box!.target;

  const { error: upErr } = await supabase
    .from("otp_boxes")
    .update({
      count: newCount,
      product: productToSet,
      status: willClose ? "closed" : "open",
      closed_at: willClose ? new Date().toISOString() : null,
    })
    .eq("id", box!.id);
  if (upErr) return { error: upErr.message };

  // Link this unit's scan to the box (used later to advance the box's units).
  if (scan.id) {
    const admin = createAdminClient();
    await admin.from("scan_events").update({ meta: { otp_box_id: box!.id } }).eq("id", scan.id);
  }

  if (willClose) {
    await sendBoxToQc(supabase, { id: box!.id, box_number: box!.box_number });
  }

  return {
    ok: true,
    nextStage: scan.nextStage,
    boxClosed: willClose,
    box: {
      boxNumber: box!.box_number,
      count: newCount,
      target: box!.target,
      product: productToSet,
    },
  };
}

/** Manually close the operator's current open box (e.g. a partial box). */
export async function closeOtpBox(): Promise<{ ok?: boolean; error?: string; boxNumber?: number; count?: number }> {
  const session = await getSessionUser();
  if (!session?.profile) return { error: "Not authenticated." };
  const supabase = await createClient();

  const { data: openBox } = await supabase
    .from("otp_boxes")
    .select("id, box_number, count")
    .eq("created_by", session.userId)
    .eq("status", "open")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!openBox) return { ok: true };
  if (openBox.count === 0) {
    // nothing scanned — just close, no QC needed
    await supabase
      .from("otp_boxes")
      .update({ status: "closed", closed_at: new Date().toISOString() })
      .eq("id", openBox.id);
    return { ok: true, boxNumber: openBox.box_number, count: 0 };
  }

  const { error } = await supabase
    .from("otp_boxes")
    .update({ status: "closed", closed_at: new Date().toISOString() })
    .eq("id", openBox.id);
  if (error) return { error: error.message };

  await sendBoxToQc(supabase, { id: openBox.id, box_number: openBox.box_number });

  return { ok: true, boxNumber: openBox.box_number, count: openBox.count };
}
