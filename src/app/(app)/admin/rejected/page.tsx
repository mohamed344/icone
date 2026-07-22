import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth/session";
import { userCan } from "@/lib/auth/permissions";
import { getRejectedCartons } from "@/app/(app)/scan/carton-actions";
import { RejectedCartonsAdmin } from "@/components/admin/RejectedCartonsAdmin";

/** Re-approval of rejected cartons — admins, or users granted `approve_rejected`. */
export default async function AdminRejectedPage() {
  const session = await getSessionUser();
  if (!(await userCan(session?.profile, "approve_rejected"))) redirect("/");

  const cartons = await getRejectedCartons();
  return <RejectedCartonsAdmin initial={cartons} />;
}
