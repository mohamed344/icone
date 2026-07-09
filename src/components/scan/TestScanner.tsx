"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { getUnitQueue, findUnitByCode, testUnit, type Unit } from "@/app/(app)/scan/unit-actions";
import { useNotifications } from "@/components/notifications/NotificationsProvider";
import { useT } from "@/lib/i18n";
import { PageHeader } from "@/components/ui/PageHeader";
import { GlassCard } from "@/components/ui/GlassCard";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Modal } from "@/components/ui/Modal";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { ToolScanField } from "./ToolScanField";
import { cn } from "@/lib/cn";
import { Cpu, CheckCircle2, XCircle, AlertCircle, ScanLine, Loader2 } from "lucide-react";

type Decision = "ok" | "problem";

export function TestScanner({ initialQueue }: { initialQueue: Unit[] }) {
  const t = useT();
  const router = useRouter();
  const { onAny } = useNotifications();

  const [queue, setQueue] = useState<Unit[]>(initialQueue);
  const [target, setTarget] = useState<Unit | null>(null);
  const [decision, setDecision] = useState<Decision>("ok");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [scanErr, setScanErr] = useState<string | null>(null);
  const [, start] = useTransition();

  async function refresh() {
    try {
      setQueue(await getUnitQueue("scan_test"));
    } catch {
      /* ignore */
    }
  }

  useEffect(() => {
    return onAny((n) => {
      if (n.stage === "scan_test") void refresh();
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onAny]);

  function open(unit: Unit) {
    setTarget(unit);
    setDecision("ok");
    setReason("");
    setError(null);
  }

  async function scan(code: string) {
    const c = code.trim();
    if (!c) return;
    setScanErr(null);
    const unit = queue.find((u) => u.serial === c) ?? (await findUnitByCode("scan_test", c));
    if (!unit) {
      setScanErr(t("test.notFound"));
      return;
    }
    open(unit);
  }

  function confirm() {
    if (!target) return;
    if (decision === "problem" && !reason.trim()) {
      setError(t("test.reasonRequired"));
      return;
    }
    setBusy(true);
    setError(null);
    start(async () => {
      const res = await testUnit(target.id, decision, decision === "problem" ? reason : undefined);
      setBusy(false);
      if (res.error) {
        setError(res.error);
        return;
      }
      setQueue((q) => q.filter((u) => u.id !== target.id));
      setTarget(null);
      router.refresh();
    });
  }

  return (
    <>
      <PageHeader title={t("stage.scan_test")} subtitle={t("test.subtitle")}>
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
              <h2 className="font-display text-lg font-semibold text-foreground">{t("stage.scan_test")}</h2>
              <p className="text-xs text-faint">{t("test.scanHint")}</p>
            </div>
          </div>
          <ToolScanField onScan={scan} placeholder={t("unit.scanSerial")} />
          {scanErr && (
            <div className="mt-3 flex items-start gap-2 rounded-2xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-600 dark:text-rose-400">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{scanErr}</span>
            </div>
          )}
        </GlassCard>

        <GlassCard padded={false} className="overflow-hidden lg:col-span-2">
          <div className="flex items-center justify-between border-b border-[var(--border)] px-5 py-3">
            <h3 className="font-display font-semibold text-foreground">{t("test.queue")}</h3>
            <button onClick={refresh} className="ring-accent rounded-lg px-2 py-1 text-xs text-muted hover:text-[var(--accent)]">
              {t("qc1.refresh")}
            </button>
          </div>
          {queue.length === 0 ? (
            <div className="py-10 text-center text-sm text-faint">{t("test.empty")}</div>
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

      <Modal open={!!target} onClose={() => setTarget(null)} title={t("test.decision")}>
        {target && (
          <div className="flex flex-col gap-4">
            <div className="flex items-center gap-3 rounded-2xl border border-[var(--border)] bg-[var(--surface-2)] p-3.5">
              <span className="grid h-11 w-11 place-items-center rounded-xl bg-[var(--accent-soft)] text-[var(--accent)]">
                <Cpu className="h-5 w-5" />
              </span>
              <div className="min-w-0">
                <div className="truncate font-mono text-sm font-semibold text-foreground">{target.serial}</div>
                {target.product && <div className="truncate text-xs text-faint">{target.product}</div>}
              </div>
            </div>

            <SegmentedControl<Decision>
              value={decision}
              onChange={setDecision}
              segments={[
                { value: "ok", label: t("test.ok"), icon: <CheckCircle2 className="h-4 w-4" /> },
                { value: "problem", label: t("test.problem"), icon: <XCircle className="h-4 w-4" /> },
              ]}
            />

            {decision === "problem" && (
              <label className="block">
                <span className="mb-1.5 block text-sm font-medium text-muted">{t("test.reason")}</span>
                <textarea
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  rows={3}
                  placeholder={t("test.reasonPlaceholder")}
                  className="ring-accent w-full resize-y rounded-2xl border border-[var(--border)] bg-[var(--surface-2)] p-3 text-sm text-foreground placeholder:text-faint focus:border-[var(--accent)]"
                />
              </label>
            )}

            {error && (
              <div className="flex items-start gap-2 rounded-2xl border border-rose-500/30 bg-rose-500/10 px-3 py-2.5 text-sm text-rose-600 dark:text-rose-400">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <div className="flex gap-2">
              <Button onClick={confirm} disabled={busy} className={cn("flex-1", decision === "problem" && "!bg-amber-500")}>
                {busy ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : decision === "ok" ? (
                  <>
                    <CheckCircle2 className="h-4 w-4" /> {t("test.toReprint")}
                  </>
                ) : (
                  <>
                    <XCircle className="h-4 w-4" /> {t("test.toNg")}
                  </>
                )}
              </Button>
              <Button variant="glass" onClick={() => setTarget(null)} disabled={busy}>
                {t("common.cancel")}
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </>
  );
}
