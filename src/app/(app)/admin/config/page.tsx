import { requireRole } from "@/lib/auth/session";
import { getOtpConfig } from "@/app/(app)/scan/otp-actions";
import { ConfigAdmin } from "@/components/admin/ConfigAdmin";

export default async function ConfigPage() {
  await requireRole(["admin"]);
  const { mode, size } = await getOtpConfig();
  return <ConfigAdmin mode={mode} size={size} />;
}
