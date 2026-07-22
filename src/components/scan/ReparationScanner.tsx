"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { getUnitQueue, findUnitByCarteOrDimo, finishReparation, type Unit } from "@/app/(app)/scan/unit-actions";
import { useNotifications } from "@/components/notifications/NotificationsProvider";
import { useT } from "@/lib/i18n";
import { notFoundMessage } from "@/lib/scan/locate";
import { emitScanPassed } from "@/lib/scan/pass-event";
import { PageHeader } from "@/components/ui/PageHeader";
import { GlassCard } from "@/components/ui/GlassCard";
import { Badge } from "@/components/ui/Badge";
import { ToolScanField } from "./ToolScanField";
import { cn } from "@/lib/cn";
import { Wrench, AlertCircle, ScanLine, CheckCircle2, RotateCcw } from "lucide-react";

const norm = (s: string) => s.trim().replace(/\s+/g, "");
const sameCode = (u: Unit, c: string) => norm(u.serial) === norm(c) || (u.dimo != null && norm(u.dimo) === norm(c));

/**
 * Reparation station: two separate scan fields.
 *  • Field 1 (enter) — scan every product entering reparation; each joins the
 *    "in reparation" list. Many can be scanned in a row.
 *  • Field 2 (return) — scan a product that's already in that list to confirm
 *    the fix and send it back to Test. Scanning a code that isn't in reparation
 *    is an error. Products flow in from NG.
 */
export function ReparationScanner({ initialQueue }: { initialQueue: Unit[] }) {
  const t = useT();
  const router = useRouter();
  const { onAny } = useNotifications();

  // Kept only to resolve a scan quickly (not rendered) + stay fresh via realtime.
  const [queue, setQueue] = useState<Unit[]>(initialQueue);
  // Products the operator has scanned into reparation (in progress) — many at once.
  const [holding, setHolding] = useState<Unit[]>([]);
  const [busy, setBusy] = useState(false);
  const [scanErr, setScanErr] = useState<string | null>(null);
  const [matchErr, setMatchErr] = useState<string | null>(null);
  const [okMsg, setOkMsg] = useState<string | null>(null);
  const [, start] = useTransition();

  async function refresh() {
    try {
      setQueue(await getUnitQueue("reparation"));
    } catch {
      /* ignore */
    }
  }

  useEffect(() => {
    return onAny((n) => {
      if (n.stage === "reparation") void refresh();
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onAny]);

  // Field 1 — enter a product into reparation (repeatable; many at a time).
  async function enter(raw: string) {
    const c = raw.trim();
    if (!c) return;
    setScanErr(null);
    setOkMsg(null);
    // Already in the list? Ignore the duplicate scan quietly.
    if (holding.some((u) => sameCode(u, c))) return;
    const unit = queue.find((u) => sameCode(u, c)) ?? (await findUnitByCarteOrDimo("reparation", c));
    if (!unit) {
      setScanErr(await notFoundMessage(t, c, "reparation.notFound"));
      return;
    }
    setHolding((h) => (h.some((u) => u.id === unit.id) ? h : [unit, ...h]));
  }

  // Field 2 — the code must already be in reparation, then fix → back to Test.
  function back(raw: string) {
    const c = raw.trim();
    if (!c || busy) return;
    setScanErr(null);
    const unit = holding.find((u) => sameCode(u, c));
    if (!unit) {
      setMatchErr(t("reparation.notHolding"));
      return;
    }
    setBusy(true);
    setMatchErr(null);
    start(async () => {
      const res = await finishReparation(unit.id);
      setBusy(false);
      if (res.error) {
        setMatchErr(res.error);
        return;
      }
      setQueue((q) => q.filter((u) => u.id !== unit.id));
      setHolding((h) => h.filter((u) => u.id !== unit.id));
      setOkMsg(`${unit.dimo ?? unit.serial} · ${t("reparation.backToTest")}`);
      emitScanPassed();
      router.refresh();
    });
  }

  function release(id: string) {
    setHolding((h) => h.filter((u) => u.id !== id));
    setMatchErr(null);
  }

  return (
    <>
      <PageHeader title={t("stage.reparation")} subtitle={t("reparation.subtitle")}>
        <Badge tone="warning" dot>
          {queue.length} {t("qc1.waiting")}
        </Badge>
      </PageHeader>

      <div className="mx-auto flex w-full max-w-4xl flex-col gap-4">
        <GlassCard className="">
          <div className="mb-4 flex items-center gap-3">
            <span className="grid h-11 w-11 place-items-center rounded-2xl bg-accent-gradient text-[var(--accent-contrast)] glow">
              <ScanLine className="h-5 w-5" />
            </span>
            <div>
              <h2 className="font-display text-lg font-semibold text-foreground">{t("stage.reparation")}</h2>
              <p className="text-xs text-faint">{t("reparation.subtitle")}</p>
            </div>
          </div>

          {/* Field 1 — enter products into reparation (many at a time). */}
          <label className="mb-2 block">
            <span className="mb-1.5 block text-sm font-semibold text-foreground">{t("reparation.enterLabel")}</span>
            <span className="mb-2 block text-xs text-faint">{t("reparation.enterHint")}</span>
          </label>
          <ToolScanField key="enter" onScan={enter} placeholder={t("reparation.scan1")} />

          {/* In-reparation list */}
          <div className="mt-3 rounded-2xl border border-[var(--border)] bg-[var(--surface-2)] p-3">
            <div className="mb-2 flex items-center gap-2">
              <span className="text-sm font-medium text-muted">{t("reparation.holding")}</span>
              {holding.length > 0 && <Badge tone="warning" className="ms-auto">{holding.length}</Badge>}
            </div>
            {holding.length === 0 ? (
              <div className="py-4 text-center text-xs text-faint">{t("reparation.holdEmpty")}</div>
            ) : (
              <ul className="space-y-1.5">
                {holding.map((u) => (
                  <li key={u.id} className="flex items-center gap-3 rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2">
                    <Wrench className="h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
                    <div className="min-w-0 flex-1">
                      <div className="truncate font-mono text-sm font-semibold text-foreground">{u.dimo ?? u.serial}</div>
                      {u.problemReason && <div className="truncate text-xs text-faint">{u.problemReason}</div>}
                    </div>
                    <button
                      type="button"
                      onClick={() => release(u.id)}
                      className="ring-accent inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium text-faint transition-colors hover:text-foreground"
                    >
                      <RotateCcw className="h-3.5 w-3.5" /> {t("reparation.release")}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Field 2 — confirm the fix & return a product to Test. */}
          <label className="mb-2 mt-4 block">
            <span className="mb-1.5 block text-sm font-semibold text-foreground">{t("reparation.backLabel")}</span>
          </label>
          <ToolScanField
            key="back"
            autoFocus={false}
            busy={busy}
            onScan={back}
            placeholder={t("reparation.scan2")}
          />

          {okMsg && (
            <div className="mt-3 flex items-center gap-2 rounded-2xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm font-medium text-emerald-600 dark:text-emerald-400">
              <CheckCircle2 className="h-4 w-4 shrink-0" />
              <span className="truncate">{okMsg}</span>
            </div>
          )}
          {(scanErr || matchErr) && (
            <div className={cn("mt-3 flex items-start gap-2 rounded-2xl border px-4 py-3 text-sm", "border-rose-500/30 bg-rose-500/10 text-rose-600 dark:text-rose-400")}>
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{scanErr ?? matchErr}</span>
            </div>
          )}
        </GlassCard>
      </div>
    </>
  );
}
