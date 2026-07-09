"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getSessionUser } from "@/lib/auth/session";
import { roleCan } from "@/lib/auth/permissions";

export interface OverrideResult {
  ok?: boolean;
  error?: string;
}

/** Chef de ligne overrides a QC#2 final decision. */
export async function overrideQc(
  id: string,
  decision: "approved" | "rejected",
  reason: string,
): Promise<OverrideResult> {
  const session = await getSessionUser();
  const role = session?.profile?.role;
  if (!role || !(await roleCan(role, "override_qc"))) {
    return { error: "You don't have permission to override QC decisions." };
  }
  if (decision === "rejected" && !reason.trim()) {
    return { error: "A reason is required to reject." };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("qc_checks")
    .update({
      decision,
      overridden_by: session!.userId,
      overridden_at: new Date().toISOString(),
      override_reason: reason.trim() || null,
    })
    .eq("id", id);

  if (error) return { error: error.message };
  revalidatePath("/chef");
  return { ok: true };
}
