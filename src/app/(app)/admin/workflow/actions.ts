"use server";

import { revalidatePath } from "next/cache";
import { getSessionUser } from "@/lib/auth/session";
import { createAdminClient } from "@/lib/supabase/admin";
import { WORKFLOW_STAGES } from "@/lib/workflow";

export interface WorkflowState {
  ok?: boolean;
  error?: string;
}

/** Admin enables/disables steps. Disabled steps are skipped in the sequence. */
export async function saveWorkflowSteps(_prev: WorkflowState, formData: FormData): Promise<WorkflowState> {
  const session = await getSessionUser();
  if (session?.profile?.role !== "admin") return { error: "Administrators only." };

  const enabled = new Set(formData.getAll("enabled").map(String));
  const rows = WORKFLOW_STAGES.map((stage, i) => ({
    stage,
    position: i + 1,
    enabled: enabled.has(stage),
  }));

  const admin = createAdminClient();
  const { error } = await admin.from("workflow_steps").upsert(rows, { onConflict: "stage" });
  if (error) return { error: error.message };

  revalidatePath("/admin/workflow");
  return { ok: true };
}
