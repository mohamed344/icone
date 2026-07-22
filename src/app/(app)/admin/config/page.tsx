import { requireRole } from "@/lib/auth/session";
import { getLineConfig } from "@/app/(app)/scan/otp-actions";
import { getModels } from "@/app/(app)/scan/carton-actions";
import { ConfigAdmin } from "@/components/admin/ConfigAdmin";

export default async function ConfigPage() {
  await requireRole(["admin"]);
  const [{ mode, size, cartonSize, palletSize }, models] = await Promise.all([getLineConfig(), getModels()]);
  return <ConfigAdmin mode={mode} size={size} cartonSize={cartonSize} palletSize={palletSize} models={models} />;
}
