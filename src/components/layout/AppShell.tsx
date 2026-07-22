"use client";

import { useState } from "react";
import { Sidebar } from "./Sidebar";
import { Topbar } from "./Topbar";
import { NotificationsProvider } from "@/components/notifications/NotificationsProvider";
import { Toaster } from "@/components/notifications/Toaster";
import type { Role } from "@/lib/auth/session";

export interface ShellUser {
  id: string;
  name: string;
  email: string;
  role: Role;
  initials: string;
  /** Delegated: can re-approve rejected cartons (surfaces that nav item). */
  canApproveRejected?: boolean;
}

/** The dashboard frame: aurora field + overlay sidebar (closed by default) +
 * topbar + content. The sidebar opens only when the topbar menu button is used. */
export function AppShell({ children, user }: { children: React.ReactNode; user: ShellUser }) {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <NotificationsProvider userId={user.id}>
      <div id="app-shell" className="relative min-h-screen">
        <div className="flex min-h-screen">
          <Sidebar user={user} mobileOpen={menuOpen} onNavigate={() => setMenuOpen(false)} />

          <div className="flex min-w-0 flex-1 flex-col">
            <Topbar user={user} onOpenMobile={() => setMenuOpen(true)} />
            <main
              className="mx-auto w-full max-w-[1400px] flex-1 px-4 py-6 sm:px-6 lg:px-8"
              style={{ display: "flex", flexDirection: "column", gap: "var(--section-gap)" }}
            >
              {children}
            </main>
          </div>
        </div>
      </div>
      <Toaster />
    </NotificationsProvider>
  );
}
