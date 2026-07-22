import { notFound } from "next/navigation";
import { requireRole } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { EmployeeForm, type EmployeeInitial } from "@/components/admin/EmployeeForm";

export default async function EditEmployeePage({ params }: { params: Promise<{ id: string }> }) {
  await requireRole(["admin"]);
  const { id } = await params;
  const supabase = await createClient();

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, full_name, employee_code, role, status, allowed_stations, permissions")
    .eq("id", id)
    .single();

  if (!profile) notFound();

  return <EmployeeForm mode="edit" initial={profile as EmployeeInitial} />;
}
