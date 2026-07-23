import "server-only";
import { createClient } from "@/lib/supabase/server";
import { getSessionUser, type Profile } from "@/lib/auth/session";
import { roleCan } from "@/lib/auth/permissions";
import { isSupervisor, type WorkflowStage } from "@/lib/workflow";

export type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>;

/**
 * The authenticated scanner plus a ready DB client, or a localized-upstream error
 * string. Shared by every scan action so the "who are you / may you scan here"
 * gate lives in exactly one place.
 */
export type ScanGuard =
  | { ok: false; error: string }
  | { ok: true; profile: Profile; userId: string; supabase: SupabaseServerClient };

/**
 * Gate a scan at `stage`: the caller must be signed in, hold the `scan`
 * capability, and — unless a supervisor — have `stage` in their allowed
 * stations. Returns the session profile, user id and a Supabase client on
 * success, or `{ error }` on any failure.
 *
 * The auth lookup is memoized per request (see getSessionUser) and validates
 * the JWT locally, so this adds no Auth-server round-trip on the hot path.
 */
export async function authorizeScan(stage: WorkflowStage): Promise<ScanGuard> {
  const session = await getSessionUser();
  if (!session?.profile) return { ok: false, error: "Not authenticated." };

  const { profile, userId } = session;
  if (!(await roleCan(profile.role, "scan"))) {
    return { ok: false, error: "Your role doesn't have permission to scan." };
  }

  // Supervisors (admin, chef de ligne) may act at any station.
  if (!isSupervisor(profile.role)) {
    if (!profile.allowed_stations?.length) {
      return { ok: false, error: "No station assigned to your account. Ask an admin." };
    }
    if (!profile.allowed_stations.includes(stage)) {
      return { ok: false, error: "This station is not assigned to you." };
    }
  }

  const supabase = await createClient();
  return { ok: true, profile, userId, supabase };
}
