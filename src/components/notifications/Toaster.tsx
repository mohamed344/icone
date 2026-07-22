"use client";

import { useNotifications } from "./NotificationsProvider";
import { useT, type DictKey } from "@/lib/i18n";
import { formatNotifTime } from "@/lib/datetime";
import { cn } from "@/lib/cn";
import { Boxes, CheckCircle2, Wrench, PackageCheck, X } from "lucide-react";

const ICON: Record<string, React.ReactNode> = {
  box_ready: <Boxes className="h-5 w-5" />,
  box_conform: <CheckCircle2 className="h-5 w-5" />,
  box_rework: <Wrench className="h-5 w-5" />,
  box_arrived: <PackageCheck className="h-5 w-5" />,
};

// Per-type theme: icon/text colour, soft badge background, accent stripe/bar.
const THEME: Record<string, { fg: string; bg: string; bar: string }> = {
  box_ready: { fg: "text-sky-500", bg: "bg-sky-500/12", bar: "bg-sky-500" },
  box_conform: { fg: "text-emerald-500", bg: "bg-emerald-500/12", bar: "bg-emerald-500" },
  box_rework: { fg: "text-amber-500", bg: "bg-amber-500/12", bar: "bg-amber-500" },
  box_arrived: { fg: "text-[var(--accent)]", bg: "bg-[var(--accent-soft)]", bar: "bg-[var(--accent)]" },
};

export function Toaster() {
  const { toasts, dismissToast } = useNotifications();
  const t = useT();

  if (toasts.length === 0) return null;

  return (
    <div className="pointer-events-none fixed end-4 top-4 z-[110] flex w-[24rem] max-w-[calc(100vw-2rem)] flex-col gap-2.5">
      {toasts.map((toast) => {
        const theme = THEME[toast.type] ?? THEME.box_arrived;
        const isArrival = toast.type === "box_arrived" || toast.type === "box_ready";
        // Arrivals read as "New box arrived" + a station chip; other events use
        // their own title. The mono line shows the box/carton code.
        const heading = isArrival ? t("notif.newBox") : t(`notif.${toast.type}.title` as DictKey);
        const stageLabel = toast.stage ? t(`stage.${toast.stage}` as DictKey) : null;

        return (
          <div
            key={toast.id}
            role="status"
            aria-live="polite"
            className="animate-toast-in pointer-events-auto relative flex items-start gap-3 overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-3.5 pe-3 shadow-2xl"
          >
            {/* Coloured accent stripe */}
            <span className={cn("absolute inset-y-0 start-0 w-1", theme.bar)} aria-hidden />

            {/* Icon badge — gently pulses for a fresh arrival */}
            <span
              className={cn(
                "grid h-10 w-10 shrink-0 place-items-center rounded-xl",
                theme.bg,
                theme.fg,
                isArrival && "animate-pulse-soft",
              )}
            >
              {ICON[toast.type] ?? <Boxes className="h-5 w-5" />}
            </span>

            <div className="min-w-0 flex-1 pb-1">
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                <span className="text-sm font-semibold text-foreground">{heading}</span>
                {stageLabel && (
                  <span className={cn("rounded-full px-2 py-0.5 text-[11px] font-semibold", theme.bg, theme.fg)}>
                    {stageLabel}
                  </span>
                )}
              </div>
              {toast.title && (
                <div className="mt-0.5 truncate font-mono text-xs text-muted">{toast.title}</div>
              )}
              {toast.body && <div className="truncate text-xs text-faint">{toast.body}</div>}
              <div className="mt-0.5 text-[11px] text-faint">{formatNotifTime(toast.created_at, t.lang)}</div>
            </div>

            <button
              onClick={() => dismissToast(toast.id)}
              className="ring-accent grid h-6 w-6 shrink-0 place-items-center rounded-lg text-faint hover:text-foreground"
              aria-label="Dismiss"
            >
              <X className="h-3.5 w-3.5" />
            </button>

            {/* Auto-dismiss progress bar (7s — matches the provider timeout) */}
            <span className={cn("animate-toast-bar absolute bottom-0 start-0 h-0.5 w-full opacity-60", theme.bar)} aria-hidden />
          </div>
        );
      })}
    </div>
  );
}
