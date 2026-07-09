import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import type { WorkflowStage } from "@/lib/workflow";

export type NotificationType = "box_ready" | "box_conform" | "box_rework" | "box_arrived";

/** Insert a notification for each recipient (service-role → bypasses RLS). */
export async function notify(
  userIds: string[],
  type: NotificationType,
  boxId: string | null,
  title: string,
  body?: string,
  stage?: WorkflowStage,
): Promise<void> {
  const ids = [...new Set(userIds.filter(Boolean))];
  if (ids.length === 0) return;
  const admin = createAdminClient();
  await admin.from("notifications").insert(
    ids.map((user_id) => ({
      user_id,
      type,
      box_id: boxId,
      title,
      body: body ?? null,
      stage: stage ?? null,
    })),
  );
}

/** Active profiles whose station / allowed_stations includes `stage`. */
export async function operatorIdsAtStage(stage: WorkflowStage): Promise<string[]> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("profiles")
    .select("id, station, allowed_stations, status")
    .neq("status", "disabled");
  return (data ?? [])
    .filter(
      (p) =>
        p.station === stage ||
        (Array.isArray(p.allowed_stations) && p.allowed_stations.includes(stage)),
    )
    .map((p) => p.id as string);
}

/** Active profiles at the QC#1 station. */
export function qc1OperatorIds(): Promise<string[]> {
  return operatorIdsAtStage("qc1_box");
}
