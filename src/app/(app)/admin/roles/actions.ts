"use server";

import { revalidatePath } from "next/cache";
import { getSessionUser } from "@/lib/auth/session";
import { createAdminClient } from "@/lib/supabase/admin";
import { ROLES, PERMISSIONS, type Permission } from "@/lib/workflow";

export interface RolesState {
  ok?: boolean;
  error?: string;
}

/** Admin saves the capability set for every role (from one form). */
export async function saveRolePermissions(_prev: RolesState, formData: FormData): Promise<RolesState> {
  const session = await getSessionUser();
  if (session?.profile?.role !== "admin") return { error: "Administrators only." };

  const admin = createAdminClient();

  for (const role of ROLES) {
    if (role === "admin") continue; // admin always has full access
    const checked = formData
      .getAll(`perm__${role}`)
      .map(String)
      .filter((p): p is Permission => PERMISSIONS.includes(p as Permission));
    const permissions = Object.fromEntries(checked.map((p) => [p, true]));

    const { error } = await admin
      .from("role_settings")
      .upsert({ role, permissions }, { onConflict: "role" });
    if (error) return { error: error.message };
  }

  revalidatePath("/admin/roles");
  return { ok: true };
}
