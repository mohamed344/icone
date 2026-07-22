"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  getUnitQueue,
  findUnitByCarteOrDimo,
  getUnitLabel,
  markReprinted,
  type Unit,
  type UnitLabel,
} from "@/app/(app)/scan/unit-actions";
import { useNotifications } from "@/components/notifications/NotificationsProvider";
import { useT } from "@/lib/i18n";
import { notFoundMessage } from "@/lib/scan/locate";
import { printSoon } from "@/lib/print/use-auto-print";
import { PageHeader } from "@/components/ui/PageHeader";
import { GlassCard } from "@/components/ui/GlassCard";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Modal } from "@/components/ui/Modal";
import { ToolScanField } from "./ToolScanField";
import { PrintableLabel } from "./PrintableLabel";
import { Printer, AlertCircle, ScanLine, Loader2, ShieldCheck } from "lucide-react";

const norm = (s: string) => s.trim().replace(/\s+/g, "");

/**
 * Reprint: two scans per product. Scan #1 identifies the unit and its label
 * prints itself immediately (no click). Scan #2 must match scan #1 before the
 * unit advances — guaranteeing the just-printed label is on the right product.
 */
export function ReprintScanner({ initialQueue }: { initialQueue: Unit[] }) {
  const t = useT();
  const router = useRouter();
  const { onAny } = useNotifications();

  const [queue, setQueue] = useState<Unit[]>(initialQueue);
  const [target, setTarget] = useState<Unit | null>(null);
  const [label, setLabel] = useState<UnitLabel | null>(null);
  const [busy, setBusy] = useState(false);
  const [scanErr, setScanErr] = useState<string | null>(null);
  const [matchErr, setMatchErr] = useState<string | null>(null);
  const [, start] = useTransition();

  // Scan #1 done → the label auto-prints the moment it renders (no click).
  useEffect(() => {
    if (target && label) return printSoon();
  }, [target, label]);

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
    setMatchErr(null);
    setLabel(await getUnitLabel(unit.id));
  }

  // Scan #1 — pick the product and print its label.
  async function scan1(code: string) {
    const c = code.trim();
    if (!c) return;
    setScanErr(null);
    const unit = queue.find((u) => u.serial === c || u.dimo === c) ?? (await findUnitByCarteOrDimo("rescan_reprint", c));
    if (!unit) {
      setScanErr(await notFoundMessage(t, c, "reprint.notFound"));
      return;
    }
    void open(unit);
  }

  // Scan #2 — must match scan #1, then advance.
  function scan2(code: string) {
    if (!target) return;
    // Confirm against the printed label (carte serial) or the product's dimo.
    const matches =
      norm(code) === norm(target.serial) || (target.dimo != null && norm(code) === norm(target.dimo));
    if (!matches) {
      setMatchErr(t("reprint.mismatch"));
      return;
    }
    setBusy(true);
    setMatchErr(null);
    start(async () => {
      const res = await markReprinted(target.id);
      setBusy(false);
      if (res.error) {
        setMatchErr(res.error);
        return;
      }
      setQueue((q) => q.filter((u) => u.id !== target.id));
      setTarget(null);
      setLabel(null);
      router.refresh();
    });
  }

  function closeModal() {
    setTarget(null);
    setLabel(null);
    setMatchErr(null);
  }

  return (
    <>
      <style>{`@media print { @page { margin: 8mm; } body * { visibility: hidden !important; } #print-label, #print-label * { visibility: visible !important; } #print-label { position: fixed; inset: 0; margin: auto; } }`}</style>

      <PageHeader title={t("stage.rescan_reprint")} subtitle={t("reprint.subtitle")}>
        <Badge tone="accent" dot>
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
              <h2 className="font-display text-lg font-semibold text-foreground">{t("stage.rescan_reprint")}</h2>
              <p className="text-xs text-faint">{t("reprint.scanHint")}</p>
            </div>
          </div>
          <ToolScanField onScan={scan1} placeholder={t("reprint.scan1")} />
          {scanErr && (
            <div className="mt-3 flex items-start gap-2 rounded-2xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-600 dark:text-rose-400">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{scanErr}</span>
            </div>
          )}
        </GlassCard>
      </div>

      {/* Label auto-prints on open; scan #2 confirms the match, then advances. */}
      <Modal open={!!target} onClose={closeModal} title={t("reprint.label")}>
        {target && label && (
          <div className="flex flex-col gap-4">
            <PrintableLabel label={label} />
            <div className="flex items-center gap-2 rounded-2xl border border-[var(--accent)]/30 bg-[var(--accent-soft)] px-4 py-3 text-sm text-foreground">
              <ShieldCheck className="h-4 w-4 shrink-0 text-[var(--accent)]" />
              <span>{t("reprint.confirmHint")}</span>
            </div>
            <ToolScanField busy={busy} onScan={scan2} placeholder={t("reprint.scan2")} />
            {matchErr && (
              <div className="flex items-start gap-2 rounded-2xl border border-rose-500/30 bg-rose-500/10 px-3 py-2.5 text-sm text-rose-600 dark:text-rose-400">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                <span>{matchErr}</span>
              </div>
            )}
            <div className="flex gap-2">
              <Button variant="glass" onClick={() => window.print()} className="flex-1">
                <Printer className="h-4 w-4" /> {t("reprint.print")}
              </Button>
              <Button variant="glass" onClick={closeModal} disabled={busy}>
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : t("common.cancel")}
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </>
  );
}
