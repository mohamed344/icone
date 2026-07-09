"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  getQc1Queue,
  findAwaitingBoxByCode,
  qc1Decision,
  type QcBox,
} from "@/app/(app)/scan/qc1-actions";
import { useNotifications } from "@/components/notifications/NotificationsProvider";
import { useT } from "@/lib/i18n";
import { PageHeader } from "@/components/ui/PageHeader";
import { GlassCard } from "@/components/ui/GlassCard";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Modal } from "@/components/ui/Modal";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { cn } from "@/lib/cn";
import { Boxes, Keyboard, Loader2, CheckCircle2, XCircle, AlertCircle, ScanLine } from "lucide-react";

type Decision = "conform" | "non_conform";

export function Qc1Scanner({ initialQueue }: { initialQueue: QcBox[] }) {
  const t = useT();
  const router = useRouter();
  const { onBoxReady } = useNotifications();

  const [queue, setQueue] = useState<QcBox[]>(initialQueue);
  const [target, setTarget] = useState<QcBox | null>(null);
  const [decision, setDecision] = useState<Decision>("conform");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [scanErr, setScanErr] = useState<string | null>(null);

  const taRef = useRef<HTMLTextAreaElement | null>(null);
  const timerRef = useRef<number | null>(null);

  async function refresh() {
    try {
      setQueue(await getQc1Queue());
    } catch {
      /* ignore */
    }
  }

  // Live: when a box_ready arrives, refresh the queue and auto-open its modal.
  useEffect(() => {
    return onBoxReady((n) => {
      void (async () => {
        const q = await getQc1Queue();
        setQueue(q);
        const box = q.find((b) => b.id === n.box_id);
        if (box && !target) openModal(box);
      })();
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onBoxReady, target]);

  function openModal(box: QcBox) {
    setTarget(box);
    setDecision("conform");
    setReason("");
    setError(null);
  }

  async function scanBox(code: string) {
    const trimmed = code.trim();
    if (!trimmed) return;
    setScanErr(null);
    const box = queue.find((b) => b.boxCode === trimmed) ?? (await findAwaitingBoxByCode(trimmed));
    if (!box) {
      setScanErr(t("qc1.notFound"));
      return;
    }
    openModal(box);
  }

  function finalizeScan() {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    const el = taRef.current;
    const raw = el?.value ?? "";
    if (el) el.value = "";
    void scanBox(raw);
    el?.focus();
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    if (e.key === "Enter") {
      e.preventDefault();
      timerRef.current = window.setTimeout(finalizeScan, 90);
    }
  }

  async function confirm() {
    if (!target) return;
    if (decision === "non_conform" && !reason.trim()) {
      setError(t("qc1.reasonRequired"));
      return;
    }
    setBusy(true);
    setError(null);
    const res = await qc1Decision(target.id, decision, decision === "non_conform" ? reason : undefined);
    setBusy(false);
    if (res.error) {
      setError(res.error);
      return;
    }
    setQueue((q) => q.filter((b) => b.id !== target.id));
    setTarget(null);
    router.refresh();
  }

  return (
    <>
      <PageHeader title={t("qc1.title")} subtitle={t("qc1.subtitle")}>
        <Badge tone="accent" dot>
          {queue.length} {t("qc1.waiting")}
        </Badge>
      </PageHeader>

      <div className="grid gap-4 lg:grid-cols-5">
        {/* Scan to open */}
        <GlassCard className="lg:col-span-3">
          <div className="mb-4 flex items-center gap-3">
            <span className="grid h-11 w-11 place-items-center rounded-2xl bg-accent-gradient text-[var(--accent-contrast)] glow">
              <ScanLine className="h-5 w-5" />
            </span>
            <div>
              <h2 className="font-display text-lg font-semibold text-foreground">{t("stage.qc1_box")}</h2>
              <p className="text-xs text-faint">{t("qc1.scanToOpen")}</p>
            </div>
          </div>

          <div className="flex items-end gap-2">
            <div className="relative flex-1">
              <Keyboard className="pointer-events-none absolute start-3 top-3.5 h-4 w-4 text-faint" />
              <textarea
                ref={taRef}
                rows={1}
                onKeyDown={onKeyDown}
                onChange={() => setScanErr(null)}
                placeholder={t("qc1.scanBox")}
                autoFocus
                spellCheck={false}
                className="ring-accent min-h-[2.75rem] w-full resize-none rounded-2xl border border-[var(--border)] bg-[var(--surface-2)] py-2.5 ps-10 pe-4 font-mono text-sm text-foreground placeholder:text-faint focus:border-[var(--accent)]"
              />
            </div>
            <Button onClick={finalizeScan}>{t("scan.record")}</Button>
          </div>
          {scanErr && (
            <div className="mt-3 flex items-start gap-2 rounded-2xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-600 dark:text-rose-400">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{scanErr}</span>
            </div>
          )}
        </GlassCard>

        {/* Queue */}
        <GlassCard padded={false} className="overflow-hidden lg:col-span-2">
          <div className="flex items-center justify-between border-b border-[var(--border)] px-5 py-3">
            <h3 className="font-display font-semibold text-foreground">{t("qc1.queue")}</h3>
            <button onClick={refresh} className="ring-accent rounded-lg px-2 py-1 text-xs text-muted hover:text-[var(--accent)]">
              {t("qc1.refresh")}
            </button>
          </div>
          {queue.length === 0 ? (
            <div className="py-10 text-center text-sm text-faint">{t("qc1.empty")}</div>
          ) : (
            <ul className="max-h-[28rem] divide-y divide-[var(--border)] overflow-y-auto">
              {queue.map((b) => (
                <li key={b.id}>
                  <button
                    onClick={() => openModal(b)}
                    className="ring-accent flex w-full items-center gap-3 px-5 py-3 text-start transition-colors hover:bg-[var(--surface-2)]"
                  >
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
                  </button>
                </li>
              ))}
            </ul>
          )}
        </GlassCard>
      </div>

      {/* Decision modal */}
      <Modal open={!!target} onClose={() => setTarget(null)} title={t("qc1.decision")}>
        {target && (
          <div className="flex flex-col gap-4">
            <div className="flex items-center gap-3 rounded-2xl border border-[var(--border)] bg-[var(--surface-2)] p-3.5">
              <span className="grid h-11 w-11 place-items-center rounded-xl bg-[var(--accent-soft)] text-[var(--accent)]">
                <Boxes className="h-5 w-5" />
              </span>
              <div className="min-w-0">
                <div className="truncate font-mono text-sm font-semibold text-foreground">
                  {target.boxCode ?? `#${target.boxNumber}`}
                </div>
                <div className="text-xs text-faint">
                  {target.count} {t("otp.units")}
                  {target.product ? ` · ${target.product}` : ""}
                </div>
              </div>
            </div>

            <SegmentedControl<Decision>
              value={decision}
              onChange={setDecision}
              segments={[
                { value: "conform", label: t("qc1.conform"), icon: <CheckCircle2 className="h-4 w-4" /> },
                { value: "non_conform", label: t("qc1.nonConform"), icon: <XCircle className="h-4 w-4" /> },
              ]}
            />

            {decision === "non_conform" && (
              <label className="block">
                <span className="mb-1.5 block text-sm font-medium text-muted">{t("qc1.reason")}</span>
                <textarea
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  rows={3}
                  placeholder={t("qc1.reasonPlaceholder")}
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
              <Button
                onClick={confirm}
                disabled={busy}
                className={cn("flex-1", decision === "non_conform" && "!bg-amber-500")}
              >
                {busy ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : decision === "conform" ? (
                  <>
                    <CheckCircle2 className="h-4 w-4" /> {t("qc1.validate")}
                  </>
                ) : (
                  <>
                    <XCircle className="h-4 w-4" /> {t("qc1.sendRework")}
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
