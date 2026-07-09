import { notFound } from "next/navigation";
import { requireRole } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { EmployeeDetails, type EmployeeDetail } from "@/components/admin/EmployeeDetails";

export default async function EmployeeDetailPage({ params }: { params: Promise<{ id: string }> }) {
  await requireRole(["admin"]);
  const { id } = await params;
  const supabase = await createClient();

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, full_name, employee_code, role, status, allowed_stations")
    .eq("id", id)
    .single();

  if (!profile) notFound();

  // email lives in auth.users — read it with the service-role client.
  let email: string | null = null;
  try {
    const admin = createAdminClient();
    const { data } = await admin.auth.admin.getUserById(id);
    email = data.user?.email ?? null;
  } catch {
    /* service key missing → show without email */
  }

  const employee: EmployeeDetail = {
    id: profile.id,
    full_name: profile.full_name,
    email,
    employee_code: profile.employee_code,
    role: profile.role,
    status: profile.status,
    allowed_stations: profile.allowed_stations,
  };

  return <EmployeeDetails employee={employee} />;
}
