import { requireRole } from "@/lib/auth/session";
import { getCarteDimoLinks } from "./actions";
import { LinksAdmin } from "@/components/admin/LinksAdmin";

export default async function AdminLinksPage() {
  await requireRole(["admin"]);
  const links = await getCarteDimoLinks();
  return <LinksAdmin initial={links} />;
}
