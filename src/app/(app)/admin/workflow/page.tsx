import { requireRole } from "@/lib/auth/session";
import { getAllSteps } from "@/lib/auth/steps";
import { WorkflowAdmin } from "@/components/admin/WorkflowAdmin";

export default async function WorkflowPage() {
  await requireRole(["admin"]);
  const steps = await getAllSteps();
  return <WorkflowAdmin steps={steps} />;
}
