import { requireRole } from "@/lib/auth/session";
import { EmployeeForm } from "@/components/admin/EmployeeForm";

export default async function NewEmployeePage() {
  await requireRole(["admin"]);
  return <EmployeeForm mode="create" />;
}
