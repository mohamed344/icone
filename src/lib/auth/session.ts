import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { Role, WorkflowStage, PermissionMap } from "@/lib/workflow";

export type { Role, WorkflowStage } from "@/lib/workflow";

export interface Profile {
  id: string;
  full_name: string | null;
  employee_code: string | null;
  role: Role;
  line_id: string | null;
  station: WorkflowStage | null;
  allowed_stations: WorkflowStage[];
  permissions: PermissionMap;
  status: "active" | "pending" | "disabled";
}

export interface SessionUser {
  userId: string;
  email: string | null;
  profile: Profile | null;
}

/**
 * Current user + profile, or null if not signed in. Memoized per request with
 * React `cache()` so repeated calls within one server action / render collapse
 * to a single `auth.getUser()` + `profiles` lookup (avoids duplicate round-trips).
 */
export const getSessionUser = cache(async (): Promise<SessionUser | null> => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, full_name, employee_code, role, line_id, station, allowed_stations, permissions, status")
    .eq("id", user.id)
    .single();

  return { userId: user.id, email: user.email ?? null, profile: (profile as Profile) ?? null };
});

/** Where each role lands after login. */
export function roleHome(role?: Role | null): string {
  switch (role) {
    case "admin":
      return "/admin";
    case "chef_de_ligne":
      return "/chef";
    default:
      return "/operator";
  }
}

/** Redirect to /login if not authenticated; otherwise return the session. */
export async function requireUser(): Promise<SessionUser> {
  const session = await getSessionUser();
  if (!session) redirect("/login");
  return session;
}

/** Require one of `roles`; otherwise bounce to the user's own role home. */
export async function requireRole(roles: Role[]): Promise<SessionUser> {
  const session = await requireUser();
  const role = session.profile?.role;
  if (!role || !roles.includes(role)) redirect(roleHome(role));
  return session;
}
