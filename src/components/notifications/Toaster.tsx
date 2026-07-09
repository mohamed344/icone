"use client";

import { useNotifications } from "./NotificationsProvider";
import { useT, type DictKey } from "@/lib/i18n";
import { cn } from "@/lib/cn";
import { Boxes, CheckCircle2, Wrench, PackageCheck, X } from "lucide-react";

const ICON: Record<string, React.ReactNode> = {
  box_ready: <Boxes className="h-5 w-5" />,
  box_conform: <CheckCircle2 className="h-5 w-5" />,
  box_rework: <Wrench className="h-5 w-5" />,
  box_arrived: <PackageCheck className="h-5 w-5" />,
};

const ACCENT: Record<string, string> = {
  box_ready: "text-[var(--accent)]",
  box_conform: "text-emerald-500",
  box_rework: "text-amber-500",
  box_arrived: "text-[var(--accent)]",
};

export function Toaster() {
  const { toasts, dismissToast } = useNotifications();
  const t = useT();

  if (toasts.length === 0) return null;

  return (
    <div className="fixed end-4 top-4 z-[110] flex w-[22rem] max-w-[calc(100vw-2rem)] flex-col gap-2">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className="animate-fade-up flex items-start gap-3 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-3.5 shadow-xl"
        >
          <span className={cn("mt-0.5 shrink-0", ACCENT[toast.type] ?? "text-[var(--accent)]")}>
            {ICON[toast.type] ?? <Boxes className="h-5 w-5" />}
          </span>
          <div className="min-w-0 flex-1">
            <div className="text-sm font-semibold text-foreground">
              {toast.type === "box_arrived" && toast.stage
                ? t(`stage.${toast.stage}` as DictKey)
                : t(`notif.${toast.type}.title` as DictKey)}
            </div>
            <div className="truncate text-xs text-muted">
              {t(`notif.${toast.type}.body` as DictKey)} {toast.title}
              {toast.body ? ` — ${toast.body}` : ""}
            </div>
          </div>
          <button
            onClick={() => dismissToast(toast.id)}
            className="ring-accent grid h-6 w-6 shrink-0 place-items-center rounded-lg text-faint hover:text-foreground"
            aria-label="Dismiss"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      ))}
    </div>
  );
}
