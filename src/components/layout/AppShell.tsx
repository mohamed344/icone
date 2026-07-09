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
}

/** The dashboard frame: aurora field + role-aware sidebar + topbar + content. */
export function AppShell({ children, user }: { children: React.ReactNode; user: ShellUser }) {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <NotificationsProvider userId={user.id}>
      <div className="relative min-h-screen">
        <div className="flex min-h-screen">
          <Sidebar
            user={user}
            collapsed={collapsed}
            onToggleCollapse={() => setCollapsed((c) => !c)}
            mobileOpen={mobileOpen}
            onNavigate={() => setMobileOpen(false)}
          />

          <div className="flex min-w-0 flex-1 flex-col">
            <Topbar user={user} onOpenMobile={() => setMobileOpen(true)} />
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
