import { requireRole } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { RolesAdmin, type RoleRow } from "@/components/admin/RolesAdmin";
import { ROLES, defaultPermissions, type Role, type PermissionMap } from "@/lib/workflow";

export default async function RolesPage() {
  await requireRole(["admin"]);
  const supabase = await createClient();

  const { data } = await supabase.from("role_settings").select("role, permissions, description");
  const byRole = new Map((data ?? []).map((r) => [r.role as Role, r]));

  // Ensure every role appears, even before 0005's seed has run.
  const roles: RoleRow[] = ROLES.map((role) => {
    const row = byRole.get(role);
    return {
      role,
      permissions: (row?.permissions as PermissionMap) ?? defaultPermissions(role),
      description: (row?.description as string | null) ?? null,
    };
  });

  return <RolesAdmin roles={roles} />;
}
