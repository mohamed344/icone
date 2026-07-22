"use client";

import { useState } from "react";
import { recordOtpScan, closeOtpBox, getOtpWaitingCount, getBoxLabel, type OtpConfig, type OtpBoxView } from "@/app/(app)/scan/otp-actions";
import { useT } from "@/lib/i18n";
import { parseScan } from "@/lib/scan/parse-scan";
import { seqScanErrorMessage } from "@/lib/scan/scan-error";
import { PageHeader } from "@/components/ui/PageHeader";
import { GlassCard } from "@/components/ui/GlassCard";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Modal } from "@/components/ui/Modal";
import { printSoon } from "@/lib/print/use-auto-print";
import { BoxLabel } from "./BoxLabel";
import { ToolScanField } from "./ToolScanField";
import { cn } from "@/lib/cn";
import { Boxes, CheckCircle2, AlertCircle, PackageCheck, Package, Hourglass, Printer, Barcode as BarcodeIcon } from "lucide-react";

interface DoneBox {
  boxNumber: number;
  count: number;
  product: string | null;
  boxCode: string | null;
}

export function OtpScanner({
  config,
  initialBox = null,
  initialWaiting = 0,
  initialDone = [],
}: {
  config: OtpConfig;
  initialBox?: OtpBoxView | null;
  initialWaiting?: number;
  initialDone?: DoneBox[];
}) {
  const t = useT();
  const isCount = config.mode === "count";

  const [waiting, setWaiting] = useState(initialWaiting);
  async function refreshWaiting() {
    try {
      setWaiting(await getOtpWaitingCount());
    } catch {
      /* ignore */
    }
  }

  const [product, setProduct] = useState(initialBox?.product ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [current, setCurrent] = useState<OtpBoxView | null>(initialBox);
  const [done, setDone] = useState<DoneBox[]>(initialDone);
  const [lastCode, setLastCode] = useState<string | null>(null);
  const [flashClosed, setFlashClosed] = useState<number | null>(null);
  // The closed box whose printable barcode ticket is shown (auto-opens on close).
  const [labelBox, setLabelBox] = useState<DoneBox | null>(null);
  // Member carte serials of the label box — their barcodes print on the ticket.
  const [labelSerials, setLabelSerials] = useState<string[]>([]);

  /** Show a closed box's printable ticket, loading its member barcodes. */
  async function openLabel(box: DoneBox, print: boolean) {
    setLabelBox(box);
    setLabelSerials([]);
    if (print) printSoon();
    if (box.boxCode) {
      try {
        setLabelSerials(await getBoxLabel(box.boxCode));
      } catch {
        /* ignore — the ticket still shows the box code */
      }
    }
  }

  async function submit(code: string) {
    // From step 1 to Binding the operator scans the carte QR (serial inside);
    // extract and record the serial (the stored identifier), not the raw QR text.
    const trimmed = parseScan(code, true).code.trim();
    if (!trimmed || busy) return;
    setBusy(true);
    setError(null);
    const res = await recordOtpScan(trimmed, isCount ? undefined : product);
    setBusy(false);

    if (res.error || res.reason) {
      setError(seqScanErrorMessage(t, res));
      return;
    }

    setLastCode(trimmed);
    void refreshWaiting();
    if (res.box) {
      if (res.boxClosed) {
        const closed: DoneBox = {
          boxNumber: res.box.boxNumber,
          count: res.box.count,
          product: res.box.product,
          boxCode: res.box.boxCode ?? null,
        };
        setDone((d) => [closed, ...d].slice(0, 20));
        setFlashClosed(res.box.boxNumber);
        // Box finished → show its barcode ticket and print it automatically.
        if (closed.boxCode) void openLabel(closed, true);
        setCurrent(null); // next scan opens a fresh box
      } else {
        setCurrent(res.box);
        setFlashClosed(null);
      }
    }
  }

  async function closeBox() {
    setBusy(true);
    const res = await closeOtpBox();
    setBusy(false);
    if (res.ok && res.boxNumber != null) {
      const closed: DoneBox = {
        boxNumber: res.boxNumber,
        count: res.count ?? 0,
        product: current?.product ?? null,
        boxCode: res.boxCode ?? null,
      };
      setDone((d) => [closed, ...d].slice(0, 20));
      // Box finished → show its barcode ticket and print it automatically.
      if (closed.boxCode) void openLabel(closed, true);
    }
    setCurrent(null);
    setFlashClosed(res.boxNumber ?? null);
  }

  const count = current?.count ?? 0;
  const target = current?.target ?? config.size;
  const pct = isCount && target ? Math.min((count / target) * 100, 100) : 0;

  return (
    <>
      {/* Only the box ticket prints, on an 80mm receipt page (not A4). */}
      <style>{`@media print { @page { size: 80mm auto; margin: 0; } html, body { margin: 0 !important; padding: 0 !important; } body * { visibility: hidden !important; } #print-label, #print-label * { visibility: visible !important; } #print-label { position: absolute !important; top: 0; left: 0; width: 80mm !important; max-width: 80mm !important; margin: 0 !important; padding: 4mm !important; border: none !important; border-radius: 0 !important; box-shadow: none !important; } #print-label svg { max-width: 100% !important; height: auto !important; } }`}</style>

      <PageHeader title={t("otp.title")} subtitle={t("otp.subtitle")}>
        <Badge tone="accent" dot>
          {isCount ? t("otp.modeCount").replace("{n}", String(config.size)) : t("otp.modeProduct")}
        </Badge>
      </PageHeader>

      <div className="mx-auto flex w-full max-w-4xl flex-col gap-4">
        {/* Scanner + current box */}
        <GlassCard className="">
          <div className="mb-4 flex items-center gap-3">
            <span className="grid h-11 w-11 place-items-center rounded-2xl bg-accent-gradient text-[var(--accent-contrast)] glow">
              <Boxes className="h-5 w-5" />
            </span>
            <div>
              <h2 className="font-display text-lg font-semibold text-foreground">{t("stage.otp_validation")}</h2>
              <p className="text-xs text-faint">{t("otp.hint")}</p>
            </div>
          </div>

          {/* Product (product mode) */}
          {!isCount && (
            <label className="mb-3 block">
              <span className="mb-1.5 block text-sm font-medium text-muted">{t("otp.product")}</span>
              <input
                value={product}
                onChange={(e) => setProduct(e.target.value)}
                placeholder={t("otp.productPlaceholder")}
                className="ring-accent h-11 w-full rounded-2xl border border-[var(--border)] bg-[var(--surface-2)] px-4 text-sm text-foreground placeholder:text-faint focus:border-[var(--accent)]"
              />
            </label>
          )}

          {/* Waiting-to-enter-OTP counter (passed step 1, not yet at OTP) */}
          <div className="mb-3 flex items-center justify-between rounded-2xl border border-[var(--border)] bg-[var(--surface-2)] px-4 py-3">
            <span className="flex items-center gap-2 text-sm font-medium text-muted">
              <Hourglass className="h-4 w-4" /> {t("otp.waitingLabel")}
            </span>
            <div className="flex items-center gap-2">
              <span className="font-display text-lg font-semibold text-foreground">{waiting}</span>
              <button
                onClick={refreshWaiting}
                className="ring-accent rounded-lg px-2 py-1 text-xs text-muted hover:text-[var(--accent)]"
              >
                {t("qc1.refresh")}
              </button>
            </div>
          </div>

          {/* Current box card */}
          <div className="mb-4 rounded-2xl border border-[var(--border)] bg-[var(--surface-2)] p-4">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-muted">
                {current ? t("otp.currentBox").replace("{n}", String(current.boxNumber)) : t("otp.newBox")}
              </span>
              {isCount ? (
                <span className="font-display text-lg font-semibold text-foreground">
                  {count}
                  <span className="text-sm text-faint"> / {target}</span>
                </span>
              ) : (
                <span className="font-display text-lg font-semibold text-foreground">{count}</span>
              )}
            </div>
            {isCount && (
              <div className="mt-3 h-2.5 overflow-hidden rounded-full bg-[var(--surface)]">
                <div className="h-full rounded-full bg-accent-gradient transition-all" style={{ width: `${pct}%` }} />
              </div>
            )}
            {!isCount && current?.product && (
              <div className="mt-2 flex items-center gap-1.5 text-xs text-faint">
                <Package className="h-3.5 w-3.5" /> {current.product}
              </div>
            )}
          </div>

          {/* Tool scan field — scans auto-submit, no button */}
          <ToolScanField onScan={submit} busy={busy} placeholder={t("scan.scanHere")} />

          <div className="mt-2">
            <Button variant="glass" size="sm" onClick={closeBox} disabled={busy || !current}>
              <PackageCheck className="h-4 w-4" /> {t("otp.closeBox")}
            </Button>
          </div>

          {flashClosed != null && (
            <div className="mt-3 flex items-center gap-2 rounded-2xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm font-medium text-emerald-600 dark:text-emerald-400">
              <CheckCircle2 className="h-4 w-4 shrink-0" />
              <span>{t("otp.boxComplete").replace("{n}", String(flashClosed))}</span>
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

        {/* Completed boxes */}
        <GlassCard className="">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="font-display text-lg font-semibold text-foreground">{t("otp.completed")}</h3>
            <span className="text-xs text-faint">{done.length}</span>
          </div>
          {done.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-[var(--border)] py-10 text-center text-sm text-faint">
              {t("otp.noBoxes")}
            </div>
          ) : (
            <ul className="space-y-2">
              {done.map((b, i) => (
                <li key={i}>
                  <button
                    type="button"
                    onClick={() => b.boxCode && openLabel(b, false)}
                    disabled={!b.boxCode}
                    className={cn(
                      "flex w-full items-center gap-3 rounded-2xl border border-[var(--border)] bg-[var(--surface-2)] px-3 py-2.5 text-start transition-colors",
                      b.boxCode ? "ring-accent hover:border-[var(--accent)]" : "cursor-default",
                    )}
                  >
                    <span className="grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-[var(--accent-soft)] text-[var(--accent)]">
                      <Boxes className="h-4 w-4" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-medium text-foreground">
                        {t("otp.box")} #{b.boxNumber}
                      </div>
                      {b.boxCode && (
                        <div className="flex items-center gap-1 truncate font-mono text-xs text-[var(--accent)]">
                          <BarcodeIcon className="h-3 w-3 shrink-0" /> {b.boxCode}
                        </div>
                      )}
                      {b.product && <div className="truncate text-xs text-faint">{b.product}</div>}
                    </div>
                    <Badge tone="success">{b.count} {t("otp.units")}</Badge>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </GlassCard>
      </div>

      {/* Auto-generated box barcode label — printable / scannable downstream. */}
      <Modal open={!!labelBox} onClose={() => setLabelBox(null)} title={t("otp.boxLabel")}>
        {labelBox?.boxCode && (
          <div className="flex flex-col gap-4">
            <BoxLabel
              boxCode={labelBox.boxCode}
              boxNumber={labelBox.boxNumber}
              count={labelBox.count}
              product={labelBox.product}
              serials={labelSerials}
            />
            <div className="flex gap-2">
              <Button variant="glass" onClick={() => window.print()} className="flex-1">
                <Printer className="h-4 w-4" /> {t("reprint.print")}
              </Button>
              <Button onClick={() => setLabelBox(null)} className="flex-1">
                <CheckCircle2 className="h-4 w-4" /> {t("common.cancel")}
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </>
  );
}
