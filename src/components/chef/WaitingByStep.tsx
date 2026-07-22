"use client";

import { useCallback, useEffect, useState } from "react";
import { useT, type DictKey } from "@/lib/i18n";
import { GlassCard } from "@/components/ui/GlassCard";
import { Badge } from "@/components/ui/Badge";
import { cn } from "@/lib/cn";
import type { StepWaiting } from "@/lib/chef/waiting";
import { fetchWaitingByStep } from "@/app/(app)/chef/actions";
import { SCAN_PASSED_EVENT } from "@/lib/scan/pass-event";
import { ChevronRight, ListChecks, Cpu, Boxes, Package } from "lucide-react";

const entityIcon = {
  item: <Cpu className="h-4 w-4" />,
  box: <Boxes className="h-4 w-4" />,
  carton: <Package className="h-4 w-4" />,
};

function StepRow({ step }: { step: StepWaiting }) {
  const t = useT();
  const [open, setOpen] = useState(false);
  const has = step.count > 0;

  return (
    <li className="rounded-2xl border border-[var(--border)] bg-[var(--surface-2)]">
      <button
        onClick={() => has && setOpen((o) => !o)}
        disabled={!has}
        className={cn(
          "ring-accent flex w-full items-center gap-3 rounded-2xl px-4 py-3 text-start",
          has ? "hover:bg-[var(--surface)]" : "cursor-default opacity-70",
        )}
      >
        <ChevronRight className={cn("h-4 w-4 shrink-0 text-faint transition-transform", open && "rotate-90", !has && "opacity-0")} />
        <span className="grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-[var(--accent-soft)] text-[var(--accent)]">
          {entityIcon[step.entity]}
        </span>
        <span className="min-w-0 flex-1 truncate font-medium text-foreground">{t(`stage.${step.stage}` as DictKey)}</span>
        <Badge tone={has ? "accent" : "neutral"}>{step.count}</Badge>
      </button>
      {open && has && (
        <div className="border-t border-[var(--border)] px-4 py-3">
          <div className="flex flex-wrap gap-1.5">
            {step.codes.map((c) => (
              <span key={c} className="rounded-lg bg-[var(--surface)] px-2 py-1 font-mono text-xs text-foreground">
                {c}
              </span>
            ))}
          </div>
          {step.count > step.codes.length && (
            <div className="mt-2 text-xs text-faint">
              {t("waiting.showing").replace("{n}", String(step.codes.length)).replace("{total}", String(step.count))}
            </div>
          )}
        </div>
      )}
    </li>
  );
}

/** Supervisor overview: the codes still waiting at each step to pass onward.
 *  Self-refreshes (poll + on focus) so counts move as codes are scanned onward
 *  — no manual page refresh needed. */
export function WaitingByStep({ steps: initial }: { steps: StepWaiting[] }) {
  const t = useT();
  const [steps, setSteps] = useState(initial);

  // Keep in sync when the server re-renders with fresh data (navigation).
  useEffect(() => setSteps(initial), [initial]);

  const refresh = useCallback(async () => {
    try {
      setSteps(await fetchWaitingByStep());
    } catch {
      /* transient — keep the last snapshot */
    }
  }, []);

  useEffect(() => {
    const id = window.setInterval(refresh, 5000);
    const onFocus = () => {
      if (document.visibilityState !== "hidden") void refresh();
    };
    // A scanner just passed a code onward → update immediately (same client).
    const onPassed = () => void refresh();
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onFocus);
    window.addEventListener(SCAN_PASSED_EVENT, onPassed);
    return () => {
      window.clearInterval(id);
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onFocus);
      window.removeEventListener(SCAN_PASSED_EVENT, onPassed);
    };
  }, [refresh]);

  const total = steps.reduce((n, s) => n + s.count, 0);

  return (
    <GlassCard>
      <div className="mb-4 flex items-center gap-2">
        <ListChecks className="h-5 w-5 text-[var(--accent)]" />
        <h3 className="font-display text-lg font-semibold text-foreground">{t("waiting.title")}</h3>
        <Badge tone="neutral" className="ms-auto">
          {total}
        </Badge>
      </div>
      {total === 0 ? (
        <div className="rounded-2xl border border-dashed border-[var(--border)] py-10 text-center text-sm text-faint">
          {t("waiting.none")}
        </div>
      ) : (
        <ul className="space-y-2">
          {steps.map((s) => (
            <StepRow key={s.stage} step={s} />
          ))}
        </ul>
      )}
    </GlassCard>
  );
}
