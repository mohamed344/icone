"use client";

import { useEffect, useState } from "react";
import {
  recordCartonScan,
  closeCartonManually,
  getCartonWaitingCount,
  takeUnitOut,
  returnUnit,
  getHeldUnits,
  type CartonView,
  type CartonLabelData,
  type ModelRef,
  type HeldUnit,
} from "@/app/(app)/scan/carton-actions";
import { useT } from "@/lib/i18n";
import { notFoundMessage } from "@/lib/scan/locate";
import { PageHeader } from "@/components/ui/PageHeader";
import { GlassCard } from "@/components/ui/GlassCard";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Modal } from "@/components/ui/Modal";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { ToolScanField } from "./ToolScanField";
import { printSoon } from "@/lib/print/use-auto-print";
import { CartonLabel } from "./CartonLabel";
import {
  Package,
  CheckCircle2,
  AlertCircle,
  PackageCheck,
  Hourglass,
  Printer,
  Wrench,
  Undo2,
  LogOut,
} from "lucide-react";

type HoldMode = "take" | "return";

export function CartonScanner({
  cartonSize,
  models,
  initialCarton = null,
  initialWaiting = 0,
  initialHeld = [],
}: {
  cartonSize: number;
  models: ModelRef[];
  initialCarton?: CartonView | null;
  initialWaiting?: number;
  initialHeld?: HeldUnit[];
}) {
  const t = useT();

  // Default to the open carton's model, else the first configured model — never
  // leave it empty (an empty model must not block scanning). The picker is hidden
  // for now, so this stays fixed at its default.
  const [model] = useState(initialCarton?.model ?? models[0]?.name ?? "");
  const [current, setCurrent] = useState<CartonView | null>(initialCarton);
  const [waiting, setWaiting] = useState(initialWaiting);
  const [labelCarton, setLabelCarton] = useState<CartonLabelData | null>(null);
  // The carton label always prints itself the moment it appears (no click).
  useEffect(() => {
    if (labelCarton) return printSoon();
  }, [labelCarton]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastCode, setLastCode] = useState<string | null>(null);
  const [flashClosed, setFlashClosed] = useState<number | null>(null);

  // Take-out / return of a single product.
  const [held, setHeld] = useState<HeldUnit[]>(initialHeld);
  const [holdMode, setHoldMode] = useState<HoldMode>("take");
  const [holdErr, setHoldErr] = useState<string | null>(null);
  const [holdMsg, setHoldMsg] = useState<string | null>(null);
  const [holdBusy, setHoldBusy] = useState(false);

  async function refreshWaiting() {
    try {
      setWaiting(await getCartonWaitingCount());
    } catch {
      /* ignore */
    }
  }

  async function submit(code: string) {
    const trimmed = code.trim();
    if (!trimmed || busy) return;
    setBusy(true);
    setError(null);
    const res = await recordCartonScan(trimmed, model);
    setBusy(false);

    if (res.error || res.reason) {
      setError(
        res.reason === "not_found"
          ? await notFoundMessage(t, trimmed, "carton.notFound")
          : res.reason === "already"
            ? t("carton.already")
            : res.reason === "unit_held"
              ? t("hold.unitHeld")
              : (res.error as string),
      );
      return;
    }

    if (res.heldBlocked) {
      // Carton is full but a product the operator took out isn't back yet.
      setError(t("hold.blockClose"));
      if (res.carton) setCurrent(res.carton);
      return;
    }

    setLastCode(trimmed);
    void refreshWaiting();
    if (res.cartonClosed && res.label) {
      const c = res.label;
      setFlashClosed(c.cartonNumber);
      setLabelCarton(c); // auto-open the printable label
      setCurrent(null);
    } else if (res.carton) {
      setCurrent(res.carton);
      setFlashClosed(null);
    }
  }

  async function closeBox() {
    setBusy(true);
    const res = await closeCartonManually();
    setBusy(false);
    if (res.reason === "held") {
      setError(t("hold.blockClose"));
      return;
    }
    if (res.label) {
      const c = res.label;
      setFlashClosed(c.cartonNumber);
      setLabelCarton(c);
    }
    setCurrent(null);
  }

  async function refreshHeld() {
    try {
      setHeld(await getHeldUnits());
    } catch {
      /* ignore */
    }
  }

  async function holdScan(dimo: string) {
    const d = dimo.trim();
    if (!d || holdBusy) return;
    setHoldBusy(true);
    setHoldErr(null);
    setHoldMsg(null);
    const res = holdMode === "take" ? await takeUnitOut(d) : await returnUnit(d);
    setHoldBusy(false);

    if (res.error || res.reason) {
      if (res.reason === "not_found") {
        setHoldErr(await notFoundMessage(t, d, "hold.notWaiting"));
        return;
      }
      const key =
        res.reason === "in_carton"
          ? "hold.inCarton"
          : res.reason === "already_out"
            ? "hold.alreadyOut"
            : res.reason === "not_out"
              ? "hold.notOut"
              : null;
      setHoldErr(key ? t(key) : (res.error as string));
      return;
    }
    setHoldMsg(`${res.dimo ?? d} · ${t(holdMode === "take" ? "hold.taken" : "hold.returned")}`);
    await refreshHeld();
    void refreshWaiting();
  }

  const count = current?.count ?? 0;
  const target = current?.target ?? cartonSize;
  const pct = target ? Math.min((count / target) * 100, 100) : 0;

  return (
    <>
      {/* Only the carton label prints, on a single page (app hidden via globals.css). */}
      <style>{`@media print { @page { margin: 8mm; } body * { visibility: hidden !important; } #print-label, #print-label * { visibility: visible !important; } #print-label { position: fixed !important; top: 0; left: 0; right: 0; margin: 0 auto !important; width: 100% !important; max-width: 720px !important; } #print-label svg { max-width: 100% !important; height: auto !important; } }`}</style>

      <PageHeader title={t("carton.title")} subtitle={t("carton.subtitle")}>
        <Badge tone="accent" dot>
          {t("carton.perCarton").replace("{n}", String(cartonSize))}
        </Badge>
      </PageHeader>

      <div className="mx-auto flex w-full max-w-4xl flex-col gap-4">
        <GlassCard className="">
          <div className="mb-4 flex items-center gap-3">
            <span className="grid h-11 w-11 place-items-center rounded-2xl bg-accent-gradient text-[var(--accent-contrast)] glow">
              <Package className="h-5 w-5" />
            </span>
            <div>
              <h2 className="font-display text-lg font-semibold text-foreground">{t("stage.carton_printing")}</h2>
              <p className="text-xs text-faint">{t("carton.hint")}</p>
            </div>
          </div>

          {/* Waiting-to-carton counter */}
          <div className="mb-3 flex items-center justify-between rounded-2xl border border-[var(--border)] bg-[var(--surface-2)] px-4 py-3">
            <span className="flex items-center gap-2 text-sm font-medium text-muted">
              <Hourglass className="h-4 w-4" /> {t("carton.waitingLabel")}
            </span>
            <div className="flex items-center gap-2">
              <span className="font-display text-lg font-semibold text-foreground">{waiting}</span>
              <button onClick={refreshWaiting} className="ring-accent rounded-lg px-2 py-1 text-xs text-muted hover:text-[var(--accent)]">
                {t("qc1.refresh")}
              </button>
            </div>
          </div>

          {/* Current carton progress */}
          <div className="mb-4 rounded-2xl border border-[var(--border)] bg-[var(--surface-2)] p-4">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-muted">
                {current ? t("carton.current").replace("{n}", String(current.cartonNumber)) : t("carton.newCarton")}
              </span>
              <span className="font-display text-lg font-semibold text-foreground">
                {count}
                <span className="text-sm text-faint"> / {target}</span>
              </span>
            </div>
            <div className="mt-3 h-2.5 overflow-hidden rounded-full bg-[var(--surface)]">
              <div className="h-full rounded-full bg-accent-gradient transition-all" style={{ width: `${pct}%` }} />
            </div>
          </div>

          <ToolScanField onScan={submit} busy={busy} placeholder={t("scan.scanHere")} />

          <div className="mt-2">
            <Button variant="glass" size="sm" onClick={closeBox} disabled={busy || !current}>
              <PackageCheck className="h-4 w-4" /> {t("carton.closeCarton")}
            </Button>
          </div>

          {flashClosed != null && (
            <div className="mt-3 flex items-center gap-2 rounded-2xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm font-medium text-emerald-600 dark:text-emerald-400">
              <CheckCircle2 className="h-4 w-4 shrink-0" />
              <span>{t("carton.complete").replace("{n}", String(flashClosed))}</span>
            </div>
          )}
          {lastCode && flashClosed == null && !error && (
            <div className="mt-3 flex items-center gap-2 rounded-2xl border border-[var(--border)] bg-[var(--surface-2)] px-4 py-2.5 text-sm text-muted">
              <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-500" />
              <span className="truncate font-mono">{lastCode}</span>
            </div>
          )}
          {error && (
            <div className="mt-3 flex items-start gap-2 rounded-2xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-600 dark:text-rose-400">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}
        </GlassCard>

        {/* Separate flow: take one product out of the pool / return it. */}
        <GlassCard>
        <div className="mb-3 flex items-center gap-3">
          <span className="grid h-10 w-10 place-items-center rounded-2xl bg-amber-500/15 text-amber-600 dark:text-amber-400">
            <Wrench className="h-5 w-5" />
          </span>
          <div>
            <h3 className="font-display text-lg font-semibold text-foreground">{t("hold.title")}</h3>
            <p className="text-xs text-faint">{t("hold.hint")}</p>
          </div>
          {held.length > 0 && <Badge tone="warning" className="ms-auto">{held.length} {t("hold.out")}</Badge>}
        </div>

        <div className="grid gap-3 lg:grid-cols-2">
          <div>
            <SegmentedControl<HoldMode>
              value={holdMode}
              onChange={(m) => {
                setHoldMode(m);
                setHoldErr(null);
                setHoldMsg(null);
              }}
              segments={[
                { value: "take", label: t("hold.take"), icon: <LogOut className="h-4 w-4" /> },
                { value: "return", label: t("hold.return"), icon: <Undo2 className="h-4 w-4" /> },
              ]}
            />
            <div className="mt-3">
              <ToolScanField
                key={holdMode}
                busy={holdBusy}
                placeholder={t(holdMode === "take" ? "hold.scanTake" : "hold.scanReturn")}
                onScan={holdScan}
              />
            </div>
            {holdMsg && (
              <div className="mt-3 flex items-center gap-2 rounded-2xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-2.5 text-sm font-medium text-emerald-600 dark:text-emerald-400">
                <CheckCircle2 className="h-4 w-4 shrink-0" />
                <span className="truncate">{holdMsg}</span>
              </div>
            )}
            {holdErr && (
              <div className="mt-3 flex items-start gap-2 rounded-2xl border border-rose-500/30 bg-rose-500/10 px-4 py-2.5 text-sm text-rose-600 dark:text-rose-400">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                <span>{holdErr}</span>
              </div>
            )}
          </div>

          <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface-2)] p-3">
            <div className="mb-2 flex items-center justify-between">
              <span className="text-sm font-medium text-muted">{t("hold.outList")}</span>
              <button onClick={refreshHeld} className="ring-accent rounded-lg px-2 py-1 text-xs text-muted hover:text-[var(--accent)]">
                {t("qc1.refresh")}
              </button>
            </div>
            {held.length === 0 ? (
              <div className="py-6 text-center text-xs text-faint">{t("hold.outEmpty")}</div>
            ) : (
              <ul className="space-y-1.5">
                {held.map((u) => (
                  <li key={u.id} className="flex items-center gap-2 rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2">
                    <LogOut className="h-3.5 w-3.5 shrink-0 text-amber-500" />
                    <span className="truncate font-mono text-sm text-foreground">{u.dimo ?? u.serial}</span>
                    {u.product && <span className="ms-auto truncate text-xs text-faint">{u.product}</span>}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
        </GlassCard>
      </div>

      {/* Auto-generated carton label — auto-prints on open; scannable downstream. */}
      <Modal open={!!labelCarton} onClose={() => setLabelCarton(null)} title={t("carton.label")}>
        {labelCarton && (
          <div className="flex flex-col gap-4">
            <CartonLabel label={labelCarton} />
            <div className="flex gap-2">
              <Button variant="glass" onClick={() => window.print()} className="flex-1">
                <Printer className="h-4 w-4" /> {t("reprint.print")}
              </Button>
              <Button onClick={() => setLabelCarton(null)} className="flex-1">
                <CheckCircle2 className="h-4 w-4" /> {t("common.cancel")}
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </>
  );
}
