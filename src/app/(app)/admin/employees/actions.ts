"use server";

import { revalidatePath } from "next/cache";
import { getSessionUser } from "@/lib/auth/session";
import { createAdminClient } from "@/lib/supabase/admin";
import { ROLES, WORKFLOW_STAGES, type Role, type WorkflowStage } from "@/lib/workflow";

export interface EmployeeState {
  ok?: boolean;
  error?: string;
  mode?: "create" | "update";
}

/**
 * Create or update an employee. Admin-only. `id` present → update; otherwise
 * create a new auth account (the DB trigger seeds the profile) then patch the
 * structured fields (role, line, stations, permissions, status).
 */
export async function saveEmployee(_prev: EmployeeState, formData: FormData): Promise<EmployeeState> {
  const session = await getSessionUser();
  if (session?.profile?.role !== "admin") return { error: "Administrators only." };

  const id = String(formData.get("id") ?? "").trim();
  const isUpdate = id.length > 0;

  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const fullName = String(formData.get("name") ?? "").trim();
  const employeeCode = String(formData.get("employee_code") ?? "").trim();
  const role = String(formData.get("role") ?? "operator") as Role;
  const status = String(formData.get("status") ?? "active");

  if (!ROLES.includes(role)) return { error: "Invalid role." };

  // multi-select stations
  const allowedStations = formData
    .getAll("allowed_stations")
    .map(String)
    .filter((s): s is WorkflowStage => WORKFLOW_STAGES.includes(s as WorkflowStage));

  const primaryStation: WorkflowStage | null = allowedStations[0] ?? null;

  // Most permissions are managed per role (see /admin/roles). `approve_rejected`
  // is delegated per employee here (admins have it inherently).
  const approveRejected = formData.get("approve_rejected") != null;

  const profileFields = {
    full_name: fullName || null,
    employee_code: employeeCode || null,
    role,
    station: primaryStation,
    allowed_stations: allowedStations,
    permissions: { approve_rejected: approveRejected },
    status,
  };

  const admin = createAdminClient();

  if (isUpdate) {
    const { error } = await admin.from("profiles").update(profileFields).eq("id", id);
    if (error) return { error: error.message };
    if (password) {
      if (password.length < 8) return { error: "Password must be at least 8 characters." };
      const { error: pwErr } = await admin.auth.admin.updateUserById(id, { password });
      if (pwErr) return { error: pwErr.message };
    }
    revalidatePath("/admin/employees");
    return { ok: true, mode: "update" };
  }

  // create
  if (!email || !password) return { error: "Email and password are required." };
  if (password.length < 8) return { error: "Password must be at least 8 characters." };

  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: fullName || null, role, status },
  });
  if (error) return { error: error.message };

  const newId = data.user?.id;
  if (newId) {
    const { error: upErr } = await admin.from("profiles").update(profileFields).eq("id", newId);
    if (upErr) return { error: upErr.message };
  }

  revalidatePath("/admin/employees");
  return { ok: true, mode: "create" };
}

export interface DeleteState {
  ok?: boolean;
  error?: string;
}

/** Admin permanently deletes an employee (auth user + cascaded profile). */
export async function deleteEmployee(id: string): Promise<DeleteState> {
  const session = await getSessionUser();
  if (session?.profile?.role !== "admin") return { error: "Administrators only." };
  if (session.userId === id) return { error: "You can't delete your own account." };

  const admin = createAdminClient();
  const { error } = await admin.auth.admin.deleteUser(id);
  if (error) return { error: error.message };

  revalidatePath("/admin/employees");
  return { ok: true };
}
