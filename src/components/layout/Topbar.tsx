"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/cn";
import { useT, type DictKey } from "@/lib/i18n";
import { useTheme } from "@/lib/theme/theme-context";
import { resolveMode, ENABLED_LANGUAGES } from "@/lib/theme/theme-config";
import { Avatar } from "@/components/ui/Avatar";
import { useNotifications } from "@/components/notifications/NotificationsProvider";
import type { ShellUser } from "./AppShell";
import { Menu, Search, Sun, Moon, Bell, Languages, CheckCheck } from "lucide-react";

const LANG_LABEL: Record<string, string> = { en: "EN", ar: "ع", fr: "FR" };

export function Topbar({ user, onOpenMobile }: { user: ShellUser; onOpenMobile: () => void }) {
  const t = useT();
  const { items, unread, markAllRead, markRead } = useNotifications();
  const [openNotif, setOpenNotif] = useState(false);
  const notifRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!openNotif) return;
    const onClick = (e: MouseEvent) => {
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) setOpenNotif(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [openNotif]);
  const { theme, setTheme, ready } = useTheme();
  // Gate on `ready` to avoid a hydration mismatch (matchMedia is client-only).
  const isDark = ready && resolveMode(theme.mode) === "dark";

  const toggleMode = () => setTheme({ mode: isDark ? "light" : "dark" });
  const cycleLang = () => {
    const next =
      ENABLED_LANGUAGES[(ENABLED_LANGUAGES.indexOf(theme.language) + 1) % ENABLED_LANGUAGES.length];
    setTheme({ language: next });
  };
  const showLang = ENABLED_LANGUAGES.length > 1;

  const iconBtn =
    "ring-accent grid h-10 w-10 place-items-center rounded-xl text-muted transition-colors hover:bg-[var(--accent-soft)] hover:text-[var(--accent)]";

  return (
    <header className="glass sticky top-0 z-20 flex h-[4.5rem] items-center gap-3 border-b border-[var(--glass-border)] px-4 sm:px-6">
      <button onClick={onOpenMobile} className={cn(iconBtn, "lg:hidden")} aria-label="Menu">
        <Menu className="h-5 w-5" />
      </button>

      {/* Search */}
      <div className="relative hidden flex-1 sm:block">
        <Search className="pointer-events-none absolute inset-y-0 start-3 my-auto h-4 w-4 text-faint" />
        <input
          placeholder={t("common.search")}
          className="ring-accent h-11 w-full max-w-md rounded-2xl border border-[var(--border)] bg-[var(--surface-2)] ps-10 pe-4 text-sm text-foreground placeholder:text-faint focus:border-[var(--accent)]"
        />
      </div>
      <div className="flex-1 sm:hidden" />

      <div className="flex items-center gap-1.5">
        {showLang && (
          <button onClick={cycleLang} className={cn(iconBtn, "relative w-auto px-3 gap-1.5")} aria-label="Language">
            <Languages className="h-[1.1rem] w-[1.1rem]" />
            <span className="text-xs font-semibold">{LANG_LABEL[theme.language]}</span>
          </button>
        )}
        <button onClick={toggleMode} className={iconBtn} aria-label="Theme">
          {isDark ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
        </button>
        <div className="relative" ref={notifRef}>
          <button onClick={() => setOpenNotif((o) => !o)} className={cn(iconBtn, "relative")} aria-label={t("notif.title")}>
            <Bell className="h-5 w-5" />
            {unread > 0 && (
              <span className="absolute -end-0.5 -top-0.5 grid h-4 min-w-[1rem] place-items-center rounded-full bg-[var(--accent)] px-1 text-[0.6rem] font-bold text-[var(--accent-contrast)] ring-2 ring-[var(--surface)]">
                {unread > 9 ? "9+" : unread}
              </span>
            )}
          </button>
          {openNotif && (
            <div className="glass absolute end-0 top-12 z-40 w-80 max-w-[calc(100vw-2rem)] rounded-2xl border border-[var(--glass-border)] p-2 shadow-xl">
              <div className="flex items-center justify-between px-2 py-1.5">
                <span className="text-sm font-semibold text-foreground">{t("notif.title")}</span>
                {unread > 0 && (
                  <button
                    onClick={() => markAllRead()}
                    className="ring-accent inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs text-muted hover:text-[var(--accent)]"
                  >
                    <CheckCheck className="h-3.5 w-3.5" /> {t("notif.markAll")}
                  </button>
                )}
              </div>
              <div className="max-h-80 overflow-y-auto">
                {items.length === 0 ? (
                  <div className="py-8 text-center text-sm text-faint">{t("notif.empty")}</div>
                ) : (
                  <ul className="space-y-1">
                    {items.slice(0, 20).map((n) => (
                      <li key={n.id}>
                        <button
                          onClick={() => markRead(n.id)}
                          className={cn(
                            "w-full rounded-xl px-2.5 py-2 text-start transition-colors hover:bg-[var(--surface-2)]",
                            !n.read && "bg-[var(--accent-soft)]",
                          )}
                        >
                          <div className="flex items-center gap-2">
                            {!n.read && <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--accent)]" />}
                            <span className="text-sm font-medium text-foreground">
                              {n.type === "box_arrived" && n.stage
                                ? t(`stage.${n.stage}` as DictKey)
                                : t(`notif.${n.type}.title` as DictKey)}
                            </span>
                          </div>
                          <div className="ps-3.5 text-xs text-muted">
                            {t(`notif.${n.type}.body` as DictKey)} {n.title}
                            {n.body ? ` — ${n.body}` : ""}
                          </div>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          )}
        </div>
        <div className="ms-1">
          <Avatar initials={user.initials} hue={265} presence="online" size="sm" />
        </div>
      </div>
    </header>
  );
}
