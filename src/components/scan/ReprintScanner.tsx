"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  getUnitQueue,
  findUnitByCode,
  getUnitLabel,
  markReprinted,
  type Unit,
  type UnitLabel,
} from "@/app/(app)/scan/unit-actions";
import { useNotifications } from "@/components/notifications/NotificationsProvider";
import { useT } from "@/lib/i18n";
import { PageHeader } from "@/components/ui/PageHeader";
import { GlassCard } from "@/components/ui/GlassCard";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Modal } from "@/components/ui/Modal";
import { ToolScanField } from "./ToolScanField";
import { PrintableLabel } from "./PrintableLabel";
import { Cpu, Printer, AlertCircle, ScanLine, CheckCircle2, Loader2 } from "lucide-react";

export function ReprintScanner({ initialQueue }: { initialQueue: Unit[] }) {
  const t = useT();
  const router = useRouter();
  const { onAny } = useNotifications();

  const [queue, setQueue] = useState<Unit[]>(initialQueue);
  const [target, setTarget] = useState<Unit | null>(null);
  const [label, setLabel] = useState<UnitLabel | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [, start] = useTransition();

  async function refresh() {
    try {
      setQueue(await getUnitQueue("rescan_reprint"));
    } catch {
      /* ignore */
    }
  }

  useEffect(() => {
    return onAny((n) => {
      if (n.stage === "rescan_reprint") void refresh();
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onAny]);

  async function open(unit: Unit) {
    setTarget(unit);
    setError(null);
    setLabel(await getUnitLabel(unit.id));
  }

  async function scan(code: string) {
    const c = code.trim();
    if (!c) return;
    setError(null);
    const unit = queue.find((u) => u.serial === c) ?? (await findUnitByCode("rescan_reprint", c));
    if (!unit) {
      setError(t("reprint.notFound"));
      return;
    }
    void open(unit);
  }

  function done() {
    if (!target) return;
    setBusy(true);
    start(async () => {
      const res = await markReprinted(target.id);
      setBusy(false);
      if (res.error) {
        setError(res.error);
        return;
      }
      setQueue((q) => q.filter((u) => u.id !== target.id));
      setTarget(null);
      setLabel(null);
      router.refresh();
    });
  }

  return (
    <>
      {/* Only the label prints; everything else is hidden by print CSS. */}
      <style>{`@media print { body * { visibility: hidden !important; } #print-label, #print-label * { visibility: visible !important; } #print-label { position: fixed; inset: 0; margin: auto; } }`}</style>

      <PageHeader title={t("stage.rescan_reprint")} subtitle={t("reprint.subtitle")}>
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
              <h2 className="font-display text-lg font-semibold text-foreground">{t("stage.rescan_reprint")}</h2>
              <p className="text-xs text-faint">{t("reprint.scanHint")}</p>
            </div>
          </div>
          <ToolScanField onScan={scan} placeholder={t("unit.scanSerial")} />
          {error && !target && (
            <div className="mt-3 flex items-start gap-2 rounded-2xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-600 dark:text-rose-400">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}
        </GlassCard>

        <GlassCard padded={false} className="overflow-hidden lg:col-span-2">
          <div className="flex items-center justify-between border-b border-[var(--border)] px-5 py-3">
            <h3 className="font-display font-semibold text-foreground">{t("reprint.queue")}</h3>
            <button onClick={refresh} className="ring-accent rounded-lg px-2 py-1 text-xs text-muted hover:text-[var(--accent)]">
              {t("qc1.refresh")}
            </button>
          </div>
          {queue.length === 0 ? (
            <div className="py-10 text-center text-sm text-faint">{t("reprint.empty")}</div>
          ) : (
            <ul className="max-h-[28rem] divide-y divide-[var(--border)] overflow-y-auto">
              {queue.map((u) => (
                <li key={u.id}>
                  <button
                    onClick={() => open(u)}
                    className="ring-accent flex w-full items-center gap-3 px-4 py-3 text-start transition-colors hover:bg-[var(--surface-2)]"
                  >
                    <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-[var(--accent-soft)] text-[var(--accent)]">
                      <Cpu className="h-4 w-4" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="truncate font-mono text-sm text-foreground">{u.serial}</div>
                      {u.product && <div className="truncate text-xs text-faint">{u.product}</div>}
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </GlassCard>
      </div>

      <Modal open={!!target} onClose={() => { setTarget(null); setLabel(null); }} title={t("reprint.label")}>
        {target && label && (
          <div className="flex flex-col gap-4">
            <PrintableLabel label={label} />
            {error && (
              <div className="flex items-start gap-2 rounded-2xl border border-rose-500/30 bg-rose-500/10 px-3 py-2.5 text-sm text-rose-600 dark:text-rose-400">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}
            <div className="flex gap-2">
              <Button variant="glass" onClick={() => window.print()} className="flex-1">
                <Printer className="h-4 w-4" /> {t("reprint.print")}
              </Button>
              <Button onClick={done} disabled={busy} className="flex-1">
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                {t("reprint.doneAdvance")}
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </>
  );
}
