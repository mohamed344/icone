"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { getStageQueue, findBoxAtStageByCode, passBox } from "@/app/(app)/scan/stage-actions";
import type { QcBox } from "@/app/(app)/scan/qc1-actions";
import { useNotifications } from "@/components/notifications/NotificationsProvider";
import { useT, type DictKey } from "@/lib/i18n";
import { notFoundMessage } from "@/lib/scan/locate";
import type { WorkflowStage } from "@/lib/workflow";
import { PageHeader } from "@/components/ui/PageHeader";
import { GlassCard } from "@/components/ui/GlassCard";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { ToolScanField } from "./ToolScanField";
import { Boxes, Loader2, CheckCircle2, AlertCircle, ScanLine, PackageCheck } from "lucide-react";

export function StageScanner({ stage, initialQueue }: { stage: WorkflowStage; initialQueue: QcBox[] }) {
  const t = useT();
  const router = useRouter();
  const { onAny } = useNotifications();

  const [queue, setQueue] = useState<QcBox[]>(initialQueue);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [okMsg, setOkMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [, startPass] = useTransition();

  async function refresh() {
    try {
      setQueue(await getStageQueue(stage));
    } catch {
      /* ignore */
    }
  }

  // Live: refresh the queue whenever a box arrives at this station.
  useEffect(() => {
    return onAny((n) => {
      if (n.stage === stage) void refresh();
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onAny, stage]);

  function pass(box: QcBox) {
    setBusyId(box.id);
    setError(null);
    startPass(async () => {
      const res = await passBox(box.id);
      setBusyId(null);
      if (res.error) {
        setError(res.error);
        return;
      }
      setQueue((q) => q.filter((b) => b.id !== box.id));
      setOkMsg(
        (box.boxCode ?? `#${box.boxNumber}`) +
          " · " +
          (res.nextStage
            ? t("stagework.passed").replace("{stage}", t(`stage.${res.nextStage}` as DictKey))
            : t("stagework.done")),
      );
      router.refresh();
    });
  }

  async function scan(code: string) {
    const trimmed = code.trim();
    if (!trimmed) return;
    setError(null);
    const box = queue.find((b) => b.boxCode === trimmed) ?? (await findBoxAtStageByCode(stage, trimmed));
    if (!box) {
      setError(await notFoundMessage(t, trimmed, "stagework.notFound"));
      return;
    }
    pass(box);
  }

  return (
    <>
      <PageHeader title={t(`stage.${stage}` as DictKey)} subtitle={t("stagework.subtitle")}>
        <Badge tone="accent" dot>
          {queue.length} {t("qc1.waiting")}
        </Badge>
      </PageHeader>

      <div className="mx-auto flex w-full max-w-4xl flex-col gap-4">
        {/* Scan to receive */}
        <GlassCard className="">
          <div className="mb-4 flex items-center gap-3">
            <span className="grid h-11 w-11 place-items-center rounded-2xl bg-accent-gradient text-[var(--accent-contrast)] glow">
              <ScanLine className="h-5 w-5" />
            </span>
            <div>
              <h2 className="font-display text-lg font-semibold text-foreground">{t(`stage.${stage}` as DictKey)}</h2>
              <p className="text-xs text-faint">{t("stagework.scanHint")}</p>
            </div>
          </div>

          <ToolScanField
            onScan={(c) => {
              setError(null);
              void scan(c);
            }}
            placeholder={t("stagework.scanBox")}
          />

          {okMsg && (
            <div className="mt-3 flex items-center gap-2 rounded-2xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm font-medium text-emerald-600 dark:text-emerald-400">
              <CheckCircle2 className="h-4 w-4 shrink-0" />
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

        {/* Queue */}
        <GlassCard padded={false} className="overflow-hidden">
          <div className="flex items-center justify-between border-b border-[var(--border)] px-5 py-3">
            <h3 className="font-display font-semibold text-foreground">{t("stagework.queue")}</h3>
            <button onClick={refresh} className="ring-accent rounded-lg px-2 py-1 text-xs text-muted hover:text-[var(--accent)]">
              {t("qc1.refresh")}
            </button>
          </div>
          {queue.length === 0 ? (
            <div className="py-10 text-center text-sm text-faint">{t("stagework.empty")}</div>
          ) : (
            <ul className="max-h-[28rem] divide-y divide-[var(--border)] overflow-y-auto">
              {queue.map((b) => (
                <li key={b.id} className="flex items-center gap-3 px-4 py-3">
                  <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-[var(--accent-soft)] text-[var(--accent)]">
                    <Boxes className="h-4 w-4" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-mono text-sm text-foreground">{b.boxCode ?? `#${b.boxNumber}`}</div>
                    <div className="text-xs text-faint">
                      {b.count} {t("otp.units")}
                      {b.product ? ` · ${b.product}` : ""}
                    </div>
                  </div>
                  <Button size="sm" onClick={() => pass(b)} disabled={busyId === b.id}>
                    {busyId === b.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <PackageCheck className="h-4 w-4" />}
                    {t("stagework.pass")}
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
