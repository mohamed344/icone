"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  getQc1Queue,
  findAwaitingBoxByCode,
  qc1Decision,
  type QcBox,
} from "@/app/(app)/scan/qc1-actions";
import { useT } from "@/lib/i18n";
import { notFoundMessage } from "@/lib/scan/locate";
import { PageHeader } from "@/components/ui/PageHeader";
import { GlassCard } from "@/components/ui/GlassCard";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Modal } from "@/components/ui/Modal";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { ToolScanField } from "./ToolScanField";
import { cn } from "@/lib/cn";
import { Boxes, Loader2, CheckCircle2, XCircle, AlertCircle, ScanLine } from "lucide-react";

type Decision = "conform" | "non_conform";

export function Qc1Scanner({ initialQueue }: { initialQueue: QcBox[] }) {
  const t = useT();
  const router = useRouter();

  const [queue, setQueue] = useState<QcBox[]>(initialQueue);
  const [target, setTarget] = useState<QcBox | null>(null);
  const [decision, setDecision] = useState<Decision>("conform");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [scanErr, setScanErr] = useState<string | null>(null);

  async function refresh() {
    try {
      setQueue(await getQc1Queue());
    } catch {
      /* ignore */
    }
  }

  function openModal(box: QcBox) {
    setTarget(box);
    setDecision("conform");
    // A box in rework carries its previous rejection reason — prefill it so the
    // operator sees why it was rejected (and can keep it if still non-conform).
    setReason(box.state === "rework" ? (box.reason ?? "") : "");
    setError(null);
  }

  async function scanBox(code: string) {
    const trimmed = code.trim();
    if (!trimmed) return;
    setScanErr(null);
    const box = queue.find((b) => b.boxCode === trimmed) ?? (await findAwaitingBoxByCode(trimmed));
    if (!box) {
      setScanErr(await notFoundMessage(t, trimmed, "qc1.notFound"));
      return;
    }
    openModal(box);
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

      <div className="mx-auto flex w-full max-w-4xl flex-col gap-4">
        {/* Scan to open */}
        <GlassCard className="">
          <div className="mb-4 flex items-center gap-3">
            <span className="grid h-11 w-11 place-items-center rounded-2xl bg-accent-gradient text-[var(--accent-contrast)] glow">
              <ScanLine className="h-5 w-5" />
            </span>
            <div>
              <h2 className="font-display text-lg font-semibold text-foreground">{t("stage.qc1_box")}</h2>
              <p className="text-xs text-faint">{t("qc1.scanToOpen")}</p>
            </div>
          </div>

          <ToolScanField
            onScan={(c) => {
              setScanErr(null);
              void scanBox(c);
            }}
            busy={busy}
            placeholder={t("qc1.scanBox")}
          />
          {scanErr && (
            <div className="mt-3 flex items-start gap-2 rounded-2xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-600 dark:text-rose-400">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{scanErr}</span>
            </div>
          )}
        </GlassCard>

        {/* Queue — count only (box codes are hidden; scan the box to act on it) */}
        <GlassCard padded={false} className="overflow-hidden">
          <div className="flex items-center justify-between border-b border-[var(--border)] px-5 py-3">
            <h3 className="font-display font-semibold text-foreground">{t("qc1.queue")}</h3>
            <button onClick={refresh} className="ring-accent rounded-lg px-2 py-1 text-xs text-muted hover:text-[var(--accent)]">
              {t("qc1.refresh")}
            </button>
          </div>
          <div className="flex flex-col items-center justify-center gap-2 px-5 py-12 text-center">
            <span className="grid h-12 w-12 place-items-center rounded-2xl bg-[var(--accent-soft)] text-[var(--accent)]">
              <Boxes className="h-6 w-6" />
            </span>
            <span className="font-display text-4xl font-semibold text-foreground">{queue.length}</span>
            <span className="text-sm text-muted">{t("qc1.waitingCount")}</span>
            {queue.some((b) => b.state === "rework") && (
              <Badge tone="warning">
                {queue.filter((b) => b.state === "rework").length} {t("qc1.reworkBadge")}
              </Badge>
            )}
          </div>

          {/* Non-conform boxes stay here in rework: unlike fresh boxes (hidden,
              scan-to-act), these are shown so the chef can reopen, fix and pass them. */}
          {queue.some((b) => b.state === "rework") && (
            <div className="border-t border-[var(--border)] px-5 py-4">
              <div className="mb-2.5 flex items-center gap-1.5 text-xs font-medium text-amber-600 dark:text-amber-400">
                <AlertCircle className="h-3.5 w-3.5" /> {t("qc1.reworkList")}
              </div>
              <ul className="space-y-2">
                {queue
                  .filter((b) => b.state === "rework")
                  .map((b) => (
                    <li key={b.id}>
                      <button
                        type="button"
                        onClick={() => openModal(b)}
                        className="ring-accent flex w-full items-center gap-3 rounded-2xl border border-amber-500/30 bg-amber-500/10 px-3 py-2.5 text-start transition-colors hover:border-amber-500/60"
                      >
                        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-amber-500/15 text-amber-600 dark:text-amber-400">
                          <Boxes className="h-4 w-4" />
                        </span>
                        <div className="min-w-0 flex-1">
                          <div className="truncate font-mono text-sm font-semibold text-foreground">
                            {b.boxCode ?? `#${b.boxNumber}`}
                          </div>
                          <div className="truncate text-xs text-faint">
                            {b.count} {t("otp.units")}
                            {b.product ? ` · ${b.product}` : ""}
                            {b.reason ? ` · ${b.reason}` : ""}
                          </div>
                        </div>
                        <Badge tone="warning">{t("qc1.reworkBadge")}</Badge>
                      </button>
                    </li>
                  ))}
              </ul>
            </div>
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

            {target.state === "rework" && (
              <div className="flex items-start gap-2 rounded-2xl border border-amber-500/30 bg-amber-500/10 px-3 py-2.5 text-sm text-amber-700 dark:text-amber-400">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                <span>
                  {t("qc1.previouslyRejected")}
                  {target.reason ? ` — ${target.reason}` : ""}
                </span>
              </div>
            )}

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
