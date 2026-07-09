import { requireRole } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { EmployeesList, type EmployeeRow } from "@/components/admin/EmployeesList";

export default async function EmployeesPage() {
  await requireRole(["admin"]);
  const supabase = await createClient();

  const { data } = await supabase
    .from("profiles")
    .select("id, full_name, employee_code, role, status, allowed_stations")
    .order("created_at", { ascending: false });

  return <EmployeesList employees={(data as EmployeeRow[]) ?? []} />;
}
