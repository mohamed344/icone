"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { getUnitQueue, findUnitByCode, passUnit, type Unit } from "@/app/(app)/scan/unit-actions";
import { useNotifications } from "@/components/notifications/NotificationsProvider";
import { useT, type DictKey } from "@/lib/i18n";
import type { WorkflowStage } from "@/lib/workflow";
import { PageHeader } from "@/components/ui/PageHeader";
import { GlassCard } from "@/components/ui/GlassCard";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { ToolScanField } from "./ToolScanField";
import { CheckCircle2, AlertCircle, ScanLine, Cpu, ArrowRight } from "lucide-react";

export function UnitStageScanner({ stage, initialQueue }: { stage: WorkflowStage; initialQueue: Unit[] }) {
  const t = useT();
  const router = useRouter();
  const { onAny } = useNotifications();

  const [queue, setQueue] = useState<Unit[]>(initialQueue);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [okMsg, setOkMsg] = useState<string | null>(null);
  const [, start] = useTransition();

  async function refresh() {
    try {
      setQueue(await getUnitQueue(stage));
    } catch {
      /* ignore */
    }
  }

  useEffect(() => {
    return onAny((n) => {
      if (n.stage === stage) void refresh();
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onAny, stage]);

  function pass(unit: Unit) {
    setBusy(true);
    setError(null);
    start(async () => {
      const res = await passUnit(unit.id);
      setBusy(false);
      if (res.error) {
        setError(res.error);
        return;
      }
      setQueue((q) => q.filter((u) => u.id !== unit.id));
      setOkMsg(
        unit.serial +
          " · " +
          (res.nextStage
            ? t("unit.passed").replace("{stage}", t(`stage.${res.nextStage}` as DictKey))
            : t("unit.done")),
      );
      router.refresh();
    });
  }

  async function scan(code: string) {
    const c = code.trim();
    if (!c) return;
    setError(null);
    const unit = queue.find((u) => u.serial === c) ?? (await findUnitByCode(stage, c));
    if (!unit) {
      setError(t("unit.notFound"));
      return;
    }
    pass(unit);
  }

  return (
    <>
      <PageHeader title={t(`stage.${stage}` as DictKey)} subtitle={t("unit.subtitle")}>
        <Badge tone="accent" dot>
          {queue.length} {t("qc1.waiting")}
        </Badge>
      </PageHeader>

      <div className="grid gap-4 lg:grid-cols-5">
        <GlassCard className="lg:col-span-3">
          <div className="mb-4 flex items-center gap-3">
            <span className="grid h-11 w-11 place-items-center rounded-2xl bg-accent-gradient text-[var(--accent-contrast)] glow">
              <ScanLine className="h-5 w-5" />
            </span>
            <div>
              <h2 className="font-display text-lg font-semibold text-foreground">{t(`stage.${stage}` as DictKey)}</h2>
              <p className="text-xs text-faint">{t("unit.scanHint")}</p>
            </div>
          </div>

          <ToolScanField onScan={scan} busy={busy} placeholder={t("unit.scanSerial")} />

          {okMsg && (
            <div className="mt-3 flex items-center gap-2 rounded-2xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm font-medium text-emerald-600 dark:text-emerald-400">
              <CheckCircle2 className="h-4 w-4 shrink-0" />
              <ArrowRight className="h-4 w-4 shrink-0 flip-rtl" />
              <span className="truncate">{okMsg}</span>
            </div>
          )}
          {error && (
            <div className="mt-3 flex items-start gap-2 rounded-2xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-600 dark:text-rose-400">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}
        </GlassCard>

        <GlassCard padded={false} className="overflow-hidden lg:col-span-2">
          <div className="flex items-center justify-between border-b border-[var(--border)] px-5 py-3">
            <h3 className="font-display font-semibold text-foreground">{t("unit.queue")}</h3>
            <button onClick={refresh} className="ring-accent rounded-lg px-2 py-1 text-xs text-muted hover:text-[var(--accent)]">
              {t("qc1.refresh")}
            </button>
          </div>
          {queue.length === 0 ? (
            <div className="py-10 text-center text-sm text-faint">{t("unit.empty")}</div>
          ) : (
            <ul className="max-h-[28rem] divide-y divide-[var(--border)] overflow-y-auto">
              {queue.map((u) => (
                <li key={u.id} className="flex items-center gap-3 px-4 py-3">
                  <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-[var(--accent-soft)] text-[var(--accent)]">
                    <Cpu className="h-4 w-4" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-mono text-sm text-foreground">{u.serial}</div>
                    {u.product && <div className="truncate text-xs text-faint">{u.product}</div>}
                  </div>
                  <Button size="sm" onClick={() => pass(u)} disabled={busy}>
                    {t("unit.pass")}
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </GlassCard>
      </div>
    </>
  );
}
