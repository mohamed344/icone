import "server-only";
import { createClient } from "@/lib/supabase/server";
import {
  defaultPermissions,
  type Role,
  type Permission,
  type PermissionMap,
} from "@/lib/workflow";

/** Permissions for a role, read from role_settings (admin-managed). */
export async function getRolePermissions(role: Role): Promise<PermissionMap> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("role_settings")
    .select("permissions")
    .eq("role", role)
    .single();
  return (data?.permissions as PermissionMap) ?? defaultPermissions(role);
}

/** Whether a role is allowed a capability. Admins always pass. */
export async function roleCan(role: Role, key: Permission): Promise<boolean> {
  if (role === "admin") return true;
  const perms = await getRolePermissions(role);
  return Boolean(perms[key]);
}
