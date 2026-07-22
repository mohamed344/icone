"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  getQc2Queue,
  qc2Decision,
  type QcCarton,
  type Qc2HistoryCarton,
} from "@/app/(app)/scan/carton-actions";
import { useT } from "@/lib/i18n";
import { PageHeader } from "@/components/ui/PageHeader";
import { GlassCard } from "@/components/ui/GlassCard";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { cn } from "@/lib/cn";
import { Package, Check, X, Layers, ClipboardCheck } from "lucide-react";

/** One pending carton — approve, or reject with a required reason. */
function PendingRow({ carton, onDone }: { carton: QcCarton; onDone: (c: QcCarton, decision: "approved" | "rejected") => void }) {
  const t = useT();
  const [reason, setReason] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function run(decision: "approved" | "rejected") {
    setErr(null);
    if (decision === "rejected" && !reason.trim()) {
      setErr(t("qc2.reasonRequired"));
      return;
    }
    start(async () => {
      const res = await qc2Decision(carton.id, decision, decision === "rejected" ? reason : undefined);
      if (res.error) setErr(res.error);
      else onDone(carton, decision);
    });
  }

  return (
    <li className="rounded-2xl border border-[var(--border)] bg-[var(--surface-2)] p-3">
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-[var(--accent-soft)] text-[var(--accent)]">
            <Package className="h-4 w-4" />
          </span>
          <div className="min-w-0">
            <div className="truncate font-mono text-sm text-foreground">{carton.code ?? `#${carton.cartonNumber}`}</div>
            <div className="truncate text-xs text-faint">
              {carton.count} · {carton.model ?? "—"}
            </div>
          </div>
        </div>
        <Badge tone="warning" dot>
          {t("qc2.pending")}
        </Badge>
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <input
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder={t("qc2.reasonPlaceholder")}
          className="ring-accent h-9 min-w-0 flex-1 rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 text-sm text-foreground placeholder:text-faint focus:border-[var(--accent)]"
        />
        <Button size="sm" disabled={pending} onClick={() => run("approved")}>
          <Check className="h-4 w-4" /> {t("qc2.approve")}
        </Button>
        <Button size="sm" variant="glass" disabled={pending} onClick={() => run("rejected")}>
          <X className="h-4 w-4 text-rose-500" /> {t("qc2.reject")}
        </Button>
      </div>
      {err && <p className="mt-1.5 text-xs text-rose-500">{err}</p>}
    </li>
  );
}

/** A read-only decided carton (approved/rejected) in the history panel. */
function HistoryRow({ carton }: { carton: Qc2HistoryCarton }) {
  const t = useT();
  const approved = carton.qc2State === "approved";
  return (
    <li className="flex items-center gap-3 px-4 py-3">
      <span
        className={cn(
          "grid h-8 w-8 shrink-0 place-items-center rounded-xl",
          approved ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400" : "bg-rose-500/15 text-rose-600 dark:text-rose-400",
        )}
      >
        {approved ? <Check className="h-4 w-4" /> : <X className="h-4 w-4" />}
      </span>
      <div className="min-w-0 flex-1">
        <div className="truncate font-mono text-sm text-foreground">{carton.code ?? `#${carton.cartonNumber}`}</div>
        <div className="truncate text-xs text-faint">
          {carton.count} · {carton.model ?? "—"}
          {approved && carton.palletCode ? (
            <span className="inline-flex items-center gap-1">
              {" · "}
              <Layers className="h-3 w-3" /> {carton.palletCode}
            </span>
          ) : carton.qc2Reason ? ` · ${carton.qc2Reason}` : ""}
        </div>
      </div>
      <Badge tone={approved ? "success" : "danger"}>{t(approved ? "qc2.approved" : "qc2.rejected")}</Badge>
    </li>
  );
}

/**
 * Qualité 2 (step 10): no scan. Cartons that reached QC#2 are listed for a direct
 * Approve / Reject decision, with a read-only history of recently decided cartons
 * (and the pallet each approved carton joined).
 */
export function Qc2Scanner({
  initialQueue,
  initialHistory = [],
}: {
  initialQueue: QcCarton[];
  initialHistory?: Qc2HistoryCarton[];
}) {
  const t = useT();
  const router = useRouter();

  const [queue, setQueue] = useState<QcCarton[]>(initialQueue);
  const [history, setHistory] = useState<Qc2HistoryCarton[]>(initialHistory);

  async function refresh() {
    try {
      setQueue(await getQc2Queue());
    } catch {
      /* ignore */
    }
  }

  function onDone(carton: QcCarton, decision: "approved" | "rejected") {
    setQueue((q) => q.filter((c) => c.id !== carton.id));
    // Prepend to the local history so the operator sees the outcome immediately.
    setHistory((h) =>
      [
        {
          ...carton,
          qc2State: decision,
          palletCode: null,
          decidedAt: null,
        } as Qc2HistoryCarton,
        ...h,
      ].slice(0, 60),
    );
    router.refresh();
  }

  return (
    <>
      <PageHeader title={t("qc2.title")} subtitle={t("qc2.subtitle")}>
        <Badge tone="accent" dot>
          {queue.length} {t("qc2.queue")}
        </Badge>
      </PageHeader>

      <div className="mx-auto flex w-full max-w-4xl flex-col gap-4">
        {/* Pending decisions */}
        <GlassCard>
          <div className="mb-4 flex items-center gap-3">
            <span className="grid h-11 w-11 place-items-center rounded-2xl bg-accent-gradient text-[var(--accent-contrast)] glow">
              <ClipboardCheck className="h-5 w-5" />
            </span>
            <div className="flex-1">
              <h2 className="font-display text-lg font-semibold text-foreground">{t("stage.qc2_final")}</h2>
              <p className="text-xs text-faint">{t("qc2.subtitle")}</p>
            </div>
            <button onClick={refresh} className="ring-accent rounded-lg px-2 py-1 text-xs text-muted hover:text-[var(--accent)]">
              {t("qc1.refresh")}
            </button>
          </div>

          {queue.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-[var(--border)] py-12 text-center text-sm text-faint">
              {t("qc2.noPending")}
            </div>
          ) : (
            <ul className="space-y-2">
              {queue.map((c) => (
                <PendingRow key={c.id} carton={c} onDone={onDone} />
              ))}
            </ul>
          )}
        </GlassCard>

        {/* Recent decisions */}
        <GlassCard padded={false} className="overflow-hidden">
          <div className="flex items-center justify-between border-b border-[var(--border)] px-5 py-3">
            <h3 className="font-display font-semibold text-foreground">{t("qc2.history")}</h3>
            <span className="text-xs text-faint">{history.length}</span>
          </div>
          {history.length === 0 ? (
            <div className="py-10 text-center text-sm text-faint">{t("movement.empty")}</div>
          ) : (
            <ul className="max-h-[28rem] divide-y divide-[var(--border)] overflow-y-auto">
              {history.map((c) => (
                <HistoryRow key={c.id} carton={c} />
              ))}
            </ul>
          )}
        </GlassCard>
      </div>
    </>
  );
}
