"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/cn";
import { useT } from "@/lib/i18n";
import { navForRole } from "./nav-config";
import { signOut } from "@/app/(auth)/actions";
import { Avatar } from "@/components/ui/Avatar";
import type { ShellUser } from "./AppShell";
import { LogOut, X } from "lucide-react";

interface SidebarProps {
  user: ShellUser;
  mobileOpen: boolean;
  onNavigate: () => void;
}

export function Sidebar({ user, mobileOpen, onNavigate }: SidebarProps) {
  const pathname = usePathname();
  const t = useT();
  const nav = navForRole(user.role, user.canApproveRejected);
  const collapsed = false;

  return (
    <>
      <div
        onClick={onNavigate}
        className={cn(
          "fixed inset-0 z-30 bg-black/40 backdrop-blur-sm transition-opacity",
          mobileOpen ? "opacity-100" : "pointer-events-none opacity-0",
        )}
        aria-hidden
      />

      <aside
        className={cn(
          "glass fixed inset-y-0 z-40 flex w-[17rem] flex-col border-e border-[var(--glass-border)] transition-transform duration-300 start-0",
          mobileOpen ? "translate-x-0" : "-translate-x-full rtl:translate-x-full",
        )}
      >
        {/* Brand */}
        <div className="flex h-[4.5rem] items-center gap-3 px-5">
          <Image
            src="/icone-mark.png"
            alt={t("app.name")}
            width={40}
            height={40}
            priority
            className="h-10 w-10 shrink-0 object-contain"
          />
          <div className="min-w-0">
            <div className="font-display text-lg font-semibold leading-none text-foreground">
              {t("app.name")}
            </div>
            <div className="mt-1 truncate text-xs text-faint">{t("app.tagline")}</div>
          </div>
          <button
            onClick={onNavigate}
            className="ring-accent ms-auto grid h-9 w-9 shrink-0 place-items-center rounded-xl text-faint transition-colors hover:bg-[var(--accent-soft)] hover:text-[var(--accent)]"
            aria-label={t("common.close")}
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto px-3 py-2">
          {nav.map((group) => (
            <div key={group.titleKey} className="mb-5">
              {!collapsed && (
                <div className="mb-2 px-3 text-[0.68rem] font-semibold uppercase tracking-wider text-faint">
                  {t(group.titleKey)}
                </div>
              )}
              <ul className="space-y-1">
                {group.items.map((item) => {
                  const active = pathname === item.href || pathname.startsWith(item.href + "/");
                  const Icon = item.icon;
                  return (
                    <li key={item.href}>
                      <Link
                        href={item.href}
                        onClick={onNavigate}
                        title={collapsed ? t(item.labelKey) : undefined}
                        className={cn(
                          "ring-accent group relative flex items-center gap-3 rounded-2xl px-3 py-2.5 text-sm font-medium transition-all duration-200",
                          collapsed && "justify-center",
                          active
                            ? "text-[var(--accent)]"
                            : "text-muted hover:bg-[var(--accent-soft)] hover:text-foreground",
                        )}
                      >
                        {active && (
                          <span className="absolute inset-0 rounded-2xl bg-[var(--accent-soft)] ring-1 ring-[var(--accent)]/25" />
                        )}
                        {active && (
                          <span className="absolute inset-y-2 start-0 w-1 rounded-full bg-accent-gradient" />
                        )}
                        <Icon className="relative z-10 h-[1.15rem] w-[1.15rem] shrink-0" />
                        {!collapsed && <span className="relative z-10 truncate">{t(item.labelKey)}</span>}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </nav>

        {/* Footer: account + sign out */}
        <div className="border-t border-[var(--glass-border)] p-3">
          <div className="flex items-center gap-3 rounded-2xl p-2">
            <Avatar initials={user.initials} hue={265} presence="online" size="sm" />
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-medium text-foreground">{user.name}</div>
              <div className="truncate text-xs text-faint">{t(`role.${user.role}`)}</div>
            </div>
            <form action={signOut}>
              <button
                type="submit"
                className="ring-accent grid h-8 w-8 place-items-center rounded-xl text-faint transition-colors hover:text-[var(--accent)]"
                title={t("common.signOut")}
              >
                <LogOut className="h-4 w-4 flip-rtl" />
              </button>
            </form>
          </div>
        </div>
      </aside>
    </>
  );
}
