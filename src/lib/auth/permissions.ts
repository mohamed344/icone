import "server-only";
import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import {
  defaultPermissions,
  type Role,
  type Permission,
  type PermissionMap,
} from "@/lib/workflow";

interface ProfileLike {
  role: Role;
  permissions?: PermissionMap | null;
}

/** Permissions for a role, read from role_settings (admin-managed). Memoized
 * per request so repeated capability checks don't re-query role_settings. */
export const getRolePermissions = cache(async (role: Role): Promise<PermissionMap> => {
  const supabase = await createClient();
  const { data } = await supabase
    .from("role_settings")
    .select("permissions")
    .eq("role", role)
    .single();
  return (data?.permissions as PermissionMap) ?? defaultPermissions(role);
});

/** Whether a role is allowed a capability. Admins always pass. */
export async function roleCan(role: Role, key: Permission): Promise<boolean> {
  if (role === "admin") return true;
  const perms = await getRolePermissions(role);
  return Boolean(perms[key]);
}

/**
 * Effective capability for a specific user: admin always; else a per-employee
 * grant (profiles.permissions) or a role-level grant. Used for capabilities
 * that can be delegated to individuals, e.g. approving rejected cartons.
 */
export async function userCan(profile: ProfileLike | null | undefined, key: Permission): Promise<boolean> {
  if (!profile) return false;
  if (profile.role === "admin") return true;
  if (profile.permissions?.[key]) return true;
  return roleCan(profile.role, key);
}
