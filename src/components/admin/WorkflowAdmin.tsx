"use client";

import { useActionState, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useT, type DictKey } from "@/lib/i18n";
import { PageHeader } from "@/components/ui/PageHeader";
import { GlassCard } from "@/components/ui/GlassCard";
import { Button } from "@/components/ui/Button";
import { Toggle } from "@/components/ui/Toggle";
import { saveWorkflowSteps, type WorkflowState } from "@/app/(app)/admin/workflow/actions";
import type { WorkflowStage } from "@/lib/workflow";
import { cn } from "@/lib/cn";
import { AlertCircle, CheckCircle2 } from "lucide-react";

export interface StepRow {
  stage: WorkflowStage;
  position: number;
  enabled: boolean;
}

export function WorkflowAdmin({ steps }: { steps: StepRow[] }) {
  const t = useT();
  const router = useRouter();
  const [state, formAction, pending] = useActionState<WorkflowState, FormData>(saveWorkflowSteps, {});
  const last = useRef(state);

  const ordered = useMemo(() => [...steps].sort((a, b) => a.position - b.position), [steps]);
  const [enabled, setEnabled] = useState<Record<string, boolean>>(
    () => Object.fromEntries(ordered.map((s) => [s.stage, s.enabled])),
  );

  useEffect(() => {
    if (state !== last.current) {
      last.current = state;
      if (state.ok) router.refresh();
    }
  }, [state, router]);

  const activeCount = ordered.filter((s) => enabled[s.stage]).length;

  return (
    <>
      <PageHeader title={t("workflow.title")} subtitle={t("workflow.subtitle")}>
        <span className="rounded-full bg-[var(--accent-soft)] px-3 py-1.5 text-sm font-semibold text-[var(--accent)]">
          {activeCount} / {ordered.length}
        </span>
      </PageHeader>

      {state.error && (
        <div className="flex items-start gap-2 rounded-2xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-600 dark:text-rose-400">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{state.error}</span>
        </div>
      )}
      {state.ok && (
        <div className="flex items-start gap-2 rounded-2xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-600 dark:text-emerald-400">
          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{t("common.saved")}</span>
        </div>
      )}

      {/* Live pipeline preview */}
      <GlassCard>
        <p className="mb-4 text-xs text-faint">{t("workflow.hint")}</p>
        <div className="flex items-center overflow-x-auto pb-2">
          {ordered.map((s, i) => {
            const on = enabled[s.stage];
            return (
              <div key={s.stage} className="flex items-center">
                <div className="flex flex-col items-center gap-1.5" style={{ minWidth: 64 }}>
                  <span
                    className={cn(
                      "grid h-9 w-9 place-items-center rounded-full text-sm font-semibold transition-all",
                      on
                        ? "bg-accent-gradient text-[var(--accent-contrast)] shadow-sm"
                        : "border border-dashed border-[var(--border)] text-faint",
                    )}
                  >
                    {s.position}
                  </span>
                  <span className={cn("max-w-[64px] truncate text-center text-[0.65rem]", on ? "text-muted" : "text-faint line-through")}>
                    {t(`stage.${s.stage}` as DictKey)}
                  </span>
                </div>
                {i < ordered.length - 1 && (
                  <span className={cn("mx-1 h-0.5 w-6 shrink-0 rounded-full", on ? "bg-[var(--accent)]/40" : "bg-[var(--border)]")} />
                )}
              </div>
            );
          })}
        </div>
      </GlassCard>

      <form action={formAction}>
        {/* hidden inputs carry the enabled set to the action */}
        {ordered.filter((s) => enabled[s.stage]).map((s) => (
          <input key={s.stage} type="hidden" name="enabled" value={s.stage} />
        ))}

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {ordered.map((s) => {
            const on = enabled[s.stage];
            return (
              <div
                key={s.stage}
                className={cn(
                  "flex items-center gap-3 rounded-2xl border p-4 transition-all",
                  on
                    ? "border-[var(--border)] bg-[var(--surface-2)]"
                    : "border-dashed border-[var(--border)] bg-transparent opacity-70",
                )}
              >
                <span
                  className={cn(
                    "grid h-10 w-10 shrink-0 place-items-center rounded-xl text-sm font-bold",
                    on ? "bg-[var(--accent-soft)] text-[var(--accent)]" : "text-faint",
                  )}
                >
                  {s.position}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="truncate font-medium text-foreground">{t(`stage.${s.stage}` as DictKey)}</div>
                  <div className="text-xs text-faint">{on ? t("workflow.on") : t("workflow.off")}</div>
                </div>
                <Toggle checked={on} onChange={(v) => setEnabled((e) => ({ ...e, [s.stage]: v }))} />
              </div>
            );
          })}
        </div>

        <div className="mt-4">
          <Button type="submit" disabled={pending}>
            {t("common.save")}
          </Button>
        </div>
      </form>
    </>
  );
}
