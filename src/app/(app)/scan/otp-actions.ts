"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getSessionUser, type WorkflowStage } from "@/lib/auth/session";
import { recordScan } from "./actions";
import { notify, qc1OperatorIds } from "@/lib/notify";

/**
 * Close a box, give it a scannable code, mark it awaiting QC#1, and alert QC.
 * Returns the generated box code so the UI can print/display its barcode.
 */
async function sendBoxToQc(box: { id: string; box_number: number }): Promise<string> {
  // Format: Icone-Box{YEAR}{6-digit box number}, e.g. Icone-Box2026000001.
  // Admin client: the box may have been opened by a different operator (boxes
  // are station-shared), and RLS restricts otp_boxes updates to the creator.
  const admin = createAdminClient();
  const year = new Date().getFullYear();
  const boxCode = `Icone-Box${year}${String(box.box_number).padStart(6, "0")}`;
  await admin
    .from("otp_boxes")
    .update({ box_code: boxCode, qc_state: "awaiting" })
    .eq("id", box.id);
  const qcIds = await qc1OperatorIds();
  await notify(qcIds, "box_ready", box.id, boxCode);
  return boxCode;
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
  /** Scannable code — set only once the box is closed. */
  boxCode?: string | null;
}

export interface OtpScanResult {
  ok?: boolean;
  error?: string;
  reason?: "out_of_order" | "step_off" | "completed";
  expectedStage?: WorkflowStage;
  /** True when the code has never been scanned anywhere (out_of_order only). */
  notStarted?: boolean;
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

export interface LineConfig {
  mode: OtpMode;
  size: number;
  cartonSize: number;
  palletSize: number;
}

/** Full line configuration (OTP box + carton + pallet sizes), admin-managed. */
export async function getLineConfig(): Promise<LineConfig> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("app_config")
    .select("otp_box_mode, otp_box_size, carton_size, pallet_size")
    .eq("id", true)
    .single();
  return {
    mode: (data?.otp_box_mode as OtpMode) ?? "count",
    size: data?.otp_box_size ?? 70,
    cartonSize: data?.carton_size ?? 40,
    palletSize: data?.pallet_size ?? 35,
  };
}

/**
 * Count of items that passed step 1 (container_creation) but have NOT yet been
 * scanned at OTP — i.e. the queue waiting to enter OTP. Count only, no codes.
 * Line-wide (RLS lets any authenticated user read all scan_events).
 */
export async function getOtpWaitingCount(): Promise<number> {
  const supabase = await createClient();
  const [passedRes, doneRes] = await Promise.all([
    supabase.from("scan_events").select("code").eq("stage", "container_creation").limit(20000),
    supabase.from("scan_events").select("code").eq("stage", "otp_validation").limit(20000),
  ]);
  const done = new Set(((doneRes.data as { code: string }[]) ?? []).map((r) => r.code));
  const waiting = new Set<string>();
  for (const r of (passedRes.data as { code: string }[]) ?? []) {
    if (!done.has(r.code)) waiting.add(r.code);
  }
  return waiting.size;
}

export interface OtpDoneBox {
  boxNumber: number;
  count: number;
  product: string | null;
  boxCode: string | null;
}

/**
 * Rewrite any legacy box codes (old `BX-…` format) to the current
 * `Icone-Box{YEAR}{NNNNNN}` format. Idempotent — a no-op once all are
 * converted. Uses the admin client to fix every box regardless of owner.
 */
export async function regenerateLegacyBoxCodes(): Promise<void> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("otp_boxes")
    .select("id, box_number, box_code, closed_at, created_at")
    .not("box_code", "is", null);
  const rows =
    (data as {
      id: string;
      box_number: number;
      box_code: string | null;
      closed_at: string | null;
      created_at: string | null;
    }[]) ?? [];
  for (const b of rows) {
    if (b.box_code?.startsWith("Icone-Box")) continue; // already migrated
    const year = new Date(b.closed_at ?? b.created_at ?? new Date()).getFullYear();
    const boxCode = `Icone-Box${year}${String(b.box_number).padStart(6, "0")}`;
    await admin.from("otp_boxes").update({ box_code: boxCode }).eq("id", b.id);
  }
}

/**
 * The station's recently completed (closed) boxes, newest first — so the
 * "completed boxes" list survives leaving and returning to the screen.
 * Station-wide (shared by every operator at OTP), not per-user.
 */
export async function getRecentOtpBoxes(limit = 20): Promise<OtpDoneBox[]> {
  const session = await getSessionUser();
  if (!session?.profile) return [];
  const supabase = await createClient();
  const { data } = await supabase
    .from("otp_boxes")
    .select("box_number, count, product, box_code, closed_at")
    .eq("status", "closed")
    .order("closed_at", { ascending: false })
    .limit(limit);
  return (
    (data as { box_number: number; count: number; product: string | null; box_code: string | null }[]) ?? []
  ).map((b) => ({
    boxNumber: b.box_number,
    count: b.count,
    product: b.product,
    boxCode: b.box_code,
  }));
}

/**
 * Member carte serials scanned into a (closed) box — resolved by its scannable
 * code. Used to print the box label's per-carte barcode grid and for tracking.
 */
export async function getBoxLabel(boxCode: string): Promise<string[]> {
  const c = boxCode?.trim();
  if (!c) return [];
  const supabase = await createClient();
  const { data: box } = await supabase.from("otp_boxes").select("id").eq("box_code", c).maybeSingle();
  if (!box) return [];
  const { data: members } = await supabase
    .from("scan_events")
    .select("code")
    .eq("stage", "otp_validation")
    .contains("meta", { otp_box_id: box.id });
  return [...new Set(((members as { code: string }[]) ?? []).map((m) => m.code))].sort();
}

/**
 * The station's current OPEN box (persists across sessions/days), or null.
 * Shared by every operator at OTP: one supervisor can start a box and another
 * employee continues filling the same box — it fills by product, not by user.
 */
export async function getCurrentOtpBox(): Promise<OtpBoxView | null> {
  const session = await getSessionUser();
  if (!session?.profile) return null;
  const supabase = await createClient();
  const { data } = await supabase
    .from("otp_boxes")
    .select("box_number, count, target, product")
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

/** Next box number — a single station-wide sequence (not per-user). */
async function nextBoxNumber(supabase: Awaited<ReturnType<typeof createClient>>) {
  const { data } = await supabase
    .from("otp_boxes")
    .select("box_number")
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
      notStarted: scan.notStarted,
    };
  }

  // 2) Box accounting. Config + open-box are independent → fetch in parallel.
  // Boxes are station-shared, so writes go through the admin client (RLS limits
  // otp_boxes updates to the creator, but any operator may fill the open box).
  const supabase = await createClient();
  const admin = createAdminClient();
  const userId = session.userId;
  const prod = product?.trim() || null;

  const [cfg, openBoxRes] = await Promise.all([
    getOtpConfig(),
    supabase
      .from("otp_boxes")
      .select("id, box_number, mode, target, product, count, status")
      .eq("status", "open")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);
  const openBox = openBoxRes.data;

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
    await admin
      .from("otp_boxes")
      .update({ status: "closed", closed_at: new Date().toISOString() })
      .eq("id", box.id);
    await sendBoxToQc(box);
    box = null;
  }

  // Open a fresh box if needed.
  if (!box) {
    const box_number = await nextBoxNumber(supabase);
    const { data: created, error } = await admin
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

  const { error: upErr } = await admin
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
    await admin.from("scan_events").update({ meta: { otp_box_id: box!.id } }).eq("id", scan.id);
  }

  let boxCode: string | null = null;
  if (willClose) {
    boxCode = await sendBoxToQc({ id: box!.id, box_number: box!.box_number });
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
      boxCode,
    },
  };
}

/** Manually close the station's current open box (e.g. a partial box). */
export async function closeOtpBox(): Promise<{ ok?: boolean; error?: string; boxNumber?: number; count?: number; boxCode?: string | null }> {
  const session = await getSessionUser();
  if (!session?.profile) return { error: "Not authenticated." };
  const supabase = await createClient();
  const admin = createAdminClient();

  const { data: openBox } = await supabase
    .from("otp_boxes")
    .select("id, box_number, count")
    .eq("status", "open")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!openBox) return { ok: true };
  if (openBox.count === 0) {
    // nothing scanned — just close, no QC needed
    await admin
      .from("otp_boxes")
      .update({ status: "closed", closed_at: new Date().toISOString() })
      .eq("id", openBox.id);
    return { ok: true, boxNumber: openBox.box_number, count: 0 };
  }

  const { error } = await admin
    .from("otp_boxes")
    .update({ status: "closed", closed_at: new Date().toISOString() })
    .eq("id", openBox.id);
  if (error) return { error: error.message };

  const boxCode = await sendBoxToQc({ id: openBox.id, box_number: openBox.box_number });

  return { ok: true, boxNumber: openBox.box_number, count: openBox.count, boxCode };
}
