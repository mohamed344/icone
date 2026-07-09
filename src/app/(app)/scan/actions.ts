"use server";

import { createClient } from "@/lib/supabase/server";
import { getSessionUser, type WorkflowStage } from "@/lib/auth/session";
import { roleCan } from "@/lib/auth/permissions";
import { getEnabledStages } from "@/lib/auth/steps";
import { WORKFLOW_STAGES, type EntityType } from "@/lib/workflow";

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
  /** On success: the step this product moves to next (null = finished). */
  nextStage?: WorkflowStage | null;
}

function nextEnabledAfter(stage: WorkflowStage, enabledSet: Set<WorkflowStage>): WorkflowStage | null {
  for (let i = WORKFLOW_STAGES.indexOf(stage) + 1; i < WORKFLOW_STAGES.length; i++) {
    if (enabledSet.has(WORKFLOW_STAGES[i])) return WORKFLOW_STAGES[i];
  }
  return null;
}

/**
 * Records one immutable scan into `scan_events` (the traceability audit log)
 * and advances the product to the next step. line_id comes from the caller's
 * profile; RLS enforces same-line writes.
 */
export async function recordScan(input: ScanInput): Promise<ScanResult> {
  const code = input.code?.trim();
  if (!code) return { error: "Empty code." };

  const session = await getSessionUser();
  if (!session?.profile) return { error: "Not authenticated." };

  const { profile, userId } = session;
  if (!(await roleCan(profile.role, "scan"))) {
    return { error: "Your role doesn't have permission to scan." };
  }
  if (
    profile.role !== "admin" &&
    profile.allowed_stations?.length &&
    !profile.allowed_stations.includes(input.stage)
  ) {
    return { error: "This station is not assigned to you." };
  }
  if (profile.role !== "admin" && !profile.allowed_stations?.length) {
    return { error: "No station assigned to your account. Ask an admin." };
  }

  const supabase = await createClient();
  const enabledSet = new Set(await getEnabledStages());

  // ---- Sequential enforcement: a product advances 1 → 11 without skipping.
  // Disabled steps are auto-skipped; bypass_sequence (and admin) may scan freely.
  const canBypass = await roleCan(profile.role, "bypass_sequence");
  if (!canBypass) {
    if (!enabledSet.has(input.stage)) return { reason: "step_off" };

    const { data: last } = await supabase
      .from("scan_events")
      .select("stage")
      .eq("code", code)
      .order("scanned_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    const lastStage = last?.stage as WorkflowStage | undefined;
    const startPos = lastStage ? WORKFLOW_STAGES.indexOf(lastStage) : -1;

    let expected: WorkflowStage | null = null;
    for (let i = startPos + 1; i < WORKFLOW_STAGES.length; i++) {
      if (enabledSet.has(WORKFLOW_STAGES[i])) {
        expected = WORKFLOW_STAGES[i];
        break;
      }
    }

    if (expected === null) return { reason: "completed" };
    if (input.stage !== expected) return { reason: "out_of_order", expectedStage: expected };
  }

  const { data, error } = await supabase
    .from("scan_events")
    .insert({
      stage: input.stage,
      entity_type: input.entityType,
      code,
      result: input.result ?? "ok",
      scanned_by: userId,
      meta: input.meta ?? {},
    })
    .select("id, scanned_at")
    .single();

  if (error) return { error: error.message };

  return {
    ok: true,
    id: data.id,
    at: data.scanned_at,
    nextStage: nextEnabledAfter(input.stage, enabledSet),
  };
}
