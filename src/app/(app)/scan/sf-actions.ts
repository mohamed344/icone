"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getSessionUser } from "@/lib/auth/session";
import { roleCan } from "@/lib/auth/permissions";
import { nextEnabledStage } from "@/lib/auth/steps";
import { notify, operatorIdsAtStage } from "@/lib/notify";
import { isSupervisor, type WorkflowStage } from "@/lib/workflow";

const STAGE: WorkflowStage = "container_creation";

type Db = Awaited<ReturnType<typeof createClient>>;

/** Strip a scanned value to bare alphanumerics for tolerant matching
 * (e.g. "EMP-001", "emp 001", "*EMP001*" all normalize to "emp001"). */
const normCode = (s: string) => s.replace(/[^a-z0-9]/gi, "").toLowerCase();

/**
 * Resolve an operator's name from the value scanned on their badge. A scanned
 * barcode/QR is just text, so the value is matched against employees:
 *  1) exact, case-insensitive `employee_code`;
 *  2) a normalized match (ignoring separators/case);
 *  3) failing a code match, an exact case-insensitive `full_name` (badges that
 *     already encode the name).
 * Returns null only when nothing matches — the caller then keeps the raw text.
 */
export async function lookupOperator(code: string): Promise<{ name: string | null }> {
  const c = code?.trim();
  if (!c) return { name: null };
  const session = await getSessionUser();
  if (!session?.profile) return { name: null };

  // Service-role read: an operator can't select other profiles under RLS.
  const admin = createAdminClient();

  // 1) Exact, case-insensitive employee_code.
  const byCode = await admin
    .from("profiles")
    .select("full_name")
    .ilike("employee_code", c)
    .maybeSingle();
  if ((byCode.data as { full_name: string | null } | null)?.full_name) {
    return { name: (byCode.data as { full_name: string }).full_name };
  }

  // 3) The badge may already encode the name.
  const byName = await admin
    .from("profiles")
    .select("full_name")
    .ilike("full_name", c)
    .maybeSingle();
  if ((byName.data as { full_name: string | null } | null)?.full_name) {
    return { name: (byName.data as { full_name: string }).full_name };
  }

  // 2) Normalized code match (separators/case differences on the badge).
  const target = normCode(c);
  if (target) {
    const { data: rows } = await admin
      .from("profiles")
      .select("full_name, employee_code")
      .not("employee_code", "is", null)
      .limit(2000);
    const match = ((rows as { full_name: string | null; employee_code: string | null }[]) ?? []).find(
      (p) => normCode(p.employee_code ?? "") === target,
    );
    if (match?.full_name) return { name: match.full_name };
  }

  return { name: null };
}

export interface RegisterArticleResult {
  ok?: boolean;
  id?: string;
  error?: string;
  /** Localized by the client. */
  reason?: "duplicate" | "already_done";
}

/** Has this serial already finished Scan PCBA (an origin scan_event exists)? */
async function pcbaCompleted(supabase: Db, serial: string): Promise<boolean> {
  const { data } = await supabase
    .from("scan_events")
    .select("id")
    .eq("code", serial)
    .eq("stage", STAGE)
    .limit(1)
    .maybeSingle();
  return Boolean(data);
}

/**
 * Scan PCBA, step 1: persist the article as soon as its N° série (from the QR) is
 * read. Re-scanning the same serial is idempotent — it is only rejected once the
 * unit has FINISHED Scan PCBA (and passed to OTP). A serial that was registered
 * but not yet completed is simply re-used so the operator can carry on.
 */
export async function registerArticle(input: {
  serial: string;
  qr?: string;
}): Promise<RegisterArticleResult> {
  const serial = input.serial?.trim();
  if (!serial) return { error: "Empty serial." };

  const session = await getSessionUser();
  if (!session?.profile) return { error: "Not authenticated." };

  const { profile, userId } = session;
  if (!(await roleCan(profile.role, "scan"))) {
    return { error: "Your role doesn't have permission to scan." };
  }
  // Supervisors (admin, chef de ligne) may act at any station.
  if (!isSupervisor(profile.role)) {
    if (profile.allowed_stations?.length && !profile.allowed_stations.includes(STAGE)) {
      return { error: "This station is not assigned to you." };
    }
    if (!profile.allowed_stations?.length) {
      return { error: "No station assigned to your account. Ask an admin." };
    }
  }

  const supabase = await createClient();

  // Already registered? Re-use it unless it already finished PCBA (→ at OTP).
  const { data: existing } = await supabase
    .from("items")
    .select("id")
    .eq("serial_number", serial)
    .maybeSingle();
  if (existing) {
    if (await pcbaCompleted(supabase, serial)) return { reason: "already_done" };
    return { ok: true, id: (existing as { id: string }).id };
  }

  const { data, error } = await supabase
    .from("items")
    .insert({
      serial_number: serial,
      qr_code: input.qr?.trim() || serial,
      current_stage: STAGE,
      created_by: userId,
    })
    .select("id")
    .single();

  if (error) {
    // Unique-violation race: it was created between our check and insert.
    if ((error as { code?: string }).code === "23505") {
      return (await pcbaCompleted(supabase, serial)) ? { reason: "already_done" } : { ok: true };
    }
    return { error: error.message };
  }

  return { ok: true, id: data.id };
}

export interface PcbaPassResult {
  ok?: boolean;
  error?: string;
  /** Localized by the client. */
  reason?: "already_done";
  nextStage?: WorkflowStage | null;
}

/**
 * Scan PCBA completion (after all 3 scans pass QC OK). This is the pipeline's
 * ORIGIN step, so it is NOT order-checked like later stages — it simply writes
 * the one `container_creation` scan event that makes the unit available to OTP,
 * and advances the article. A unit only reaches OTP once this runs, so an
 * unfinished PCBA scan never passes on. A serial that already completed PCBA is
 * rejected cleanly instead of being told to "pass through OTP first".
 */
export async function recordPcbaPass(input: {
  serial: string;
  creator?: string | null;
}): Promise<PcbaPassResult> {
  const serial = input.serial?.trim();
  if (!serial) return { error: "Empty serial." };

  const session = await getSessionUser();
  if (!session?.profile) return { error: "Not authenticated." };
  const { profile, userId } = session;
  if (!(await roleCan(profile.role, "scan"))) {
    return { error: "Your role doesn't have permission to scan." };
  }
  if (!isSupervisor(profile.role)) {
    if (profile.allowed_stations?.length && !profile.allowed_stations.includes(STAGE)) {
      return { error: "This station is not assigned to you." };
    }
    if (!profile.allowed_stations?.length) {
      return { error: "No station assigned to your account. Ask an admin." };
    }
  }

  const supabase = await createClient();
  const admin = createAdminClient();

  // Already completed PCBA? (an origin scan event exists) → reject cleanly.
  const { data: done } = await supabase
    .from("scan_events")
    .select("id")
    .eq("code", serial)
    .eq("stage", STAGE)
    .limit(1)
    .maybeSingle();
  if (done) return { reason: "already_done" };

  // Write the single origin event — this is what lets the unit pass to OTP.
  const { error } = await supabase.from("scan_events").insert({
    stage: STAGE,
    entity_type: "container",
    code: serial,
    result: "ok",
    scanned_by: userId,
    meta: { serial, creator: input.creator ?? null, qc: "ok" },
  });
  if (error) return { error: error.message };

  // Advance the article and notify the next station's operators.
  const next = await nextEnabledStage(STAGE);
  await admin.from("items").update({ current_stage: next }).eq("serial_number", serial);
  if (next) await notify(await operatorIdsAtStage(next), "box_arrived", null, serial, undefined, next);

  return { ok: true, nextStage: next };
}
