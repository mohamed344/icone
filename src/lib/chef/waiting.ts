import "server-only";
import { createClient } from "@/lib/supabase/server";
import { WORKFLOW_STAGES, UNIT_STAGES, type WorkflowStage } from "@/lib/workflow";

export interface StepWaiting {
  stage: WorkflowStage;
  /** Total items waiting at this step (before the display cap). */
  count: number;
  /** The waiting codes/serials, capped for display. */
  codes: string[];
  entity: "item" | "box" | "carton";
}

type Db = Awaited<ReturnType<typeof createClient>>;

/**
 * For each of the 11 steps, the codes currently waiting there to be passed to
 * the next step. Entity differs by stage: item serials (steps 1-2, 4-9), box
 * codes (step 3), carton codes (steps 10-11). Codes are capped per step.
 *
 * The set math runs in Postgres via the `waiting_overview` RPC (one round-trip,
 * tiny payload). If that function isn't present yet — or errors — we fall back
 * to computing it in Node so the page keeps working.
 */
export async function getWaitingByStep(cap = 200): Promise<StepWaiting[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("waiting_overview", { p_cap: cap });
  if (!error && Array.isArray(data)) return data as StepWaiting[];
  return waitingByStepInNode(supabase, cap);
}

/** JS fallback: pulls the raw rows and computes the waiting sets in Node. */
async function waitingByStepInNode(supabase: Db, cap: number): Promise<StepWaiting[]> {
  const [unitsRes, ccRes, otpRes, openBoxRes, awaitingBoxRes, receptionBoxRes, qc2Res, stockRes, linksRes] = await Promise.all([
    // Steps 5-9: individually-tracked cartes by their current stage.
    supabase.from("pipeline_units").select("serial, current_stage").eq("status", "active").in("current_stage", UNIT_STAGES).limit(10000),
    // Step 1: scanned at container_creation…
    supabase.from("scan_events").select("code").eq("stage", "container_creation").limit(20000),
    // …but not yet at OTP (also drives step 2 = items in open boxes).
    supabase.from("scan_events").select("code, meta").eq("stage", "otp_validation").limit(20000),
    supabase.from("otp_boxes").select("id").eq("status", "open"),
    // Step 3: closed boxes awaiting QC#1 (fresh or being fixed in rework).
    supabase.from("otp_boxes").select("box_code, box_number").in("qc_state", ["awaiting", "rework"]).limit(2000),
    // Step 4: conform boxes waiting to be received (box-level).
    supabase.from("otp_boxes").select("box_code, box_number").eq("current_stage", "reception").limit(2000),
    // Step 10: cartons awaiting QC#2.
    supabase.from("pipeline_cartons").select("code, carton_number").eq("current_stage", "qc2_final").eq("qc2_state", "pending").limit(2000),
    // Step 11: approved cartons awaiting stock entry.
    supabase.from("pipeline_cartons").select("code, carton_number").eq("current_stage", "stock_entry").eq("stock_entered", false).limit(2000),
    // Carte→dimo pairs: the Test step shows the dimo barcode (its physical label).
    supabase.from("carte_dimo_links").select("carte_code, dimo_code").limit(20000),
  ]);

  // Steps 4-9 buckets.
  const unitBuckets = new Map<WorkflowStage, string[]>();
  for (const u of (unitsRes.data as { serial: string; current_stage: WorkflowStage }[]) ?? []) {
    const arr = unitBuckets.get(u.current_stage) ?? [];
    arr.push(u.serial);
    unitBuckets.set(u.current_stage, arr);
  }

  // From Test onward the product is worked by its dimo barcode (its physical
  // label from Binding) → show the dimo, not the internal carte serial.
  const dimoByCarte = new Map<string, string>();
  for (const l of (linksRes.data as { carte_code: string; dimo_code: string }[]) ?? []) {
    dimoByCarte.set(l.carte_code, l.dimo_code);
  }
  const dimoCodes = (stage: WorkflowStage) =>
    (unitBuckets.get(stage) ?? []).map((serial) => dimoByCarte.get(serial) ?? serial);

  // Step 1: container_creation serials not yet at OTP.
  const otpEvents = (otpRes.data as { code: string; meta: { otp_box_id?: string } | null }[]) ?? [];
  const otpSet = new Set(otpEvents.map((e) => e.code));
  const ccWaiting = [...new Set(((ccRes.data as { code: string }[]) ?? []).map((r) => r.code))].filter((c) => !otpSet.has(c));

  // Step 2: items scanned at OTP whose box is still open (not sent to QC#1).
  const openIds = new Set(((openBoxRes.data as { id: string }[]) ?? []).map((b) => b.id));
  const otpWaiting = [...new Set(otpEvents.filter((e) => e.meta?.otp_box_id && openIds.has(e.meta.otp_box_id)).map((e) => e.code))];

  // Step 3: box codes (QC#1 queue). Step 4: box codes (reception).
  const boxCodes = ((awaitingBoxRes.data as { box_code: string | null; box_number: number }[]) ?? []).map((b) => b.box_code ?? `#${b.box_number}`);
  const receptionBoxCodes = ((receptionBoxRes.data as { box_code: string | null; box_number: number }[]) ?? []).map((b) => b.box_code ?? `#${b.box_number}`);

  // Steps 10-11: carton codes.
  const cartonCodes = (rows: { code: string | null; carton_number: number }[] | null) =>
    (rows ?? []).map((c) => c.code ?? `#${c.carton_number}`);
  const qc2Codes = cartonCodes(qc2Res.data as { code: string | null; carton_number: number }[]);
  const stockCodes = cartonCodes(stockRes.data as { code: string | null; carton_number: number }[]);

  const byStage: Record<WorkflowStage, { codes: string[]; entity: "item" | "box" | "carton" }> = {
    container_creation: { codes: ccWaiting, entity: "item" },
    otp_validation: { codes: otpWaiting, entity: "item" },
    qc1_box: { codes: boxCodes, entity: "box" },
    reception: { codes: receptionBoxCodes, entity: "box" },
    serial_linking: { codes: unitBuckets.get("serial_linking") ?? [], entity: "item" },
    scan_test: { codes: dimoCodes("scan_test"), entity: "item" },
    ng_handling: { codes: dimoCodes("ng_handling"), entity: "item" },
    reparation: { codes: dimoCodes("reparation"), entity: "item" },
    rescan_reprint: { codes: dimoCodes("rescan_reprint"), entity: "item" },
    carton_printing: { codes: dimoCodes("carton_printing"), entity: "item" },
    qc2_final: { codes: qc2Codes, entity: "carton" },
    stock_entry: { codes: stockCodes, entity: "carton" },
  };

  return WORKFLOW_STAGES.map((stage) => {
    const b = byStage[stage];
    return { stage, count: b.codes.length, codes: b.codes.slice(0, cap), entity: b.entity };
  });
}
