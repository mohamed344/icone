import { AppShell, type ShellUser } from "@/components/layout/AppShell";
import { requireUser } from "@/lib/auth/session";
import { userCan } from "@/lib/auth/permissions";

function initialsFrom(name: string | null, email: string | null): string {
  const base = (name || email || "U").trim();
  const parts = base.split(/\s+/);
  if (parts.length >= 2 && parts[0] && parts[1]) {
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }
  return base.slice(0, 2).toUpperCase();
}

export default async function AppGroupLayout({ children }: { children: React.ReactNode }) {
  const session = await requireUser();
  const profile = session.profile;

  const user: ShellUser = {
    id: session.userId,
    name: profile?.full_name || session.email || "User",
    email: session.email || "",
    role: profile?.role ?? "operator",
    initials: initialsFrom(profile?.full_name ?? null, session.email),
    canApproveRejected: await userCan(profile, "approve_rejected"),
  };

  return <AppShell user={user}>{children}</AppShell>;
}
