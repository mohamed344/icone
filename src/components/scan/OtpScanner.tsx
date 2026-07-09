"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { recordOtpScan, closeOtpBox, type OtpConfig, type OtpBoxView } from "@/app/(app)/scan/otp-actions";
import { resubmitReworkBox, type QcBox } from "@/app/(app)/scan/qc1-actions";
import { useT, type DictKey } from "@/lib/i18n";
import { PageHeader } from "@/components/ui/PageHeader";
import { GlassCard } from "@/components/ui/GlassCard";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { cn } from "@/lib/cn";
import { Boxes, Keyboard, Loader2, CheckCircle2, AlertCircle, PackageCheck, Package, Wrench, RotateCcw } from "lucide-react";

interface DoneBox {
  boxNumber: number;
  count: number;
  product: string | null;
}

export function OtpScanner({
  config,
  initialBox = null,
  initialRework = [],
}: {
  config: OtpConfig;
  initialBox?: OtpBoxView | null;
  initialRework?: QcBox[];
}) {
  const t = useT();
  const router = useRouter();
  const isCount = config.mode === "count";

  const [product, setProduct] = useState(initialBox?.product ?? "");
  const [busy, setBusy] = useState(false);
  const [hasText, setHasText] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [current, setCurrent] = useState<OtpBoxView | null>(initialBox);
  const [done, setDone] = useState<DoneBox[]>([]);
  const [lastCode, setLastCode] = useState<string | null>(null);
  const [flashClosed, setFlashClosed] = useState<number | null>(null);
  const [rework, setRework] = useState<QcBox[]>(initialRework);
  const [resubmitting, startResubmit] = useTransition();

  const taRef = useRef<HTMLTextAreaElement | null>(null);
  const timerRef = useRef<number | null>(null);

  function resubmit(id: string) {
    startResubmit(async () => {
      const res = await resubmitReworkBox(id);
      if (res.ok) {
        setRework((r) => r.filter((b) => b.id !== id));
        router.refresh();
      }
    });
  }

  async function submit(code: string) {
    const trimmed = code.trim();
    if (!trimmed || busy) return;
    setBusy(true);
    setError(null);
    const res = await recordOtpScan(trimmed, isCount ? undefined : product);
    setBusy(false);

    if (res.error || res.reason) {
      const msg =
        res.reason === "out_of_order"
          ? t("scan.outOfOrder").replace("{stage}", res.expectedStage ? t(`stage.${res.expectedStage}` as DictKey) : "")
          : res.reason === "step_off"
            ? t("scan.stepOff")
            : res.reason === "completed"
              ? t("scan.completed")
              : (res.error as string);
      setError(msg);
      return;
    }

    setLastCode(trimmed);
    if (res.box) {
      if (res.boxClosed) {
        setDone((d) => [{ boxNumber: res.box!.boxNumber, count: res.box!.count, product: res.box!.product }, ...d].slice(0, 20));
        setFlashClosed(res.box.boxNumber);
        setCurrent(null); // next scan opens a fresh box
      } else {
        setCurrent(res.box);
        setFlashClosed(null);
      }
    }
  }

  function finalize() {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    const el = taRef.current;
    const raw = el?.value ?? "";
    if (el) el.value = "";
    setHasText(false);
    void submit(raw);
    el?.focus();
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    if (e.key === "Enter") {
      e.preventDefault();
      timerRef.current = window.setTimeout(finalize, 90);
    }
  }

  async function closeBox() {
    setBusy(true);
    const res = await closeOtpBox();
    setBusy(false);
    if (res.ok && res.boxNumber != null) {
      setDone((d) => [{ boxNumber: res.boxNumber!, count: res.count ?? 0, product: current?.product ?? null }, ...d].slice(0, 20));
    }
    setCurrent(null);
    setFlashClosed(res.boxNumber ?? null);
    taRef.current?.focus();
  }

  const count = current?.count ?? 0;
  const target = current?.target ?? config.size;
  const pct = isCount && target ? Math.min((count / target) * 100, 100) : 0;

  return (
    <>
      <PageHeader title={t("otp.title")} subtitle={t("otp.subtitle")}>
        <Badge tone="accent" dot>
          {isCount ? t("otp.modeCount").replace("{n}", String(config.size)) : t("otp.modeProduct")}
        </Badge>
      </PageHeader>

      <div className="grid gap-4 lg:grid-cols-5">
        {/* Scanner + current box */}
        <GlassCard className="lg:col-span-3">
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

          {/* Tool scan field */}
          <div className="flex items-end gap-2">
            <div className="relative flex-1">
              <Keyboard className="pointer-events-none absolute start-3 top-3.5 h-4 w-4 text-faint" />
              <textarea
                ref={taRef}
                rows={1}
                onKeyDown={onKeyDown}
                onChange={(e) => setHasText(e.target.value.trim().length > 0)}
                placeholder={t("scan.scanHere")}
                autoFocus
                spellCheck={false}
                className="ring-accent min-h-[2.75rem] w-full resize-y rounded-2xl border border-[var(--border)] bg-[var(--surface-2)] py-2.5 ps-10 pe-4 font-mono text-sm text-foreground placeholder:text-faint focus:border-[var(--accent)]"
              />
            </div>
            <Button onClick={finalize} disabled={busy || !hasText}>
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : t("scan.record")}
            </Button>
          </div>

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
        <GlassCard className="lg:col-span-2">
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
                <li key={i} className="flex items-center gap-3 rounded-2xl border border-[var(--border)] bg-[var(--surface-2)] px-3 py-2.5">
                  <span className="grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-[var(--accent-soft)] text-[var(--accent)]">
                    <Boxes className="h-4 w-4" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-medium text-foreground">
                      {t("otp.box")} #{b.boxNumber}
                    </div>
                    {b.product && <div className="truncate text-xs text-faint">{b.product}</div>}
                  </div>
                  <Badge tone="success">{b.count} {t("otp.units")}</Badge>
                </li>
              ))}
            </ul>
          )}
        </GlassCard>
      </div>

      {/* Rework queue — boxes QC#1 sent back */}
      {rework.length > 0 && (
        <GlassCard>
          <div className="mb-3 flex items-center gap-2">
            <Wrench className="h-5 w-5 text-amber-500" />
            <h3 className="font-display text-lg font-semibold text-foreground">{t("otp.rework")}</h3>
            <Badge tone="warning">{rework.length}</Badge>
          </div>
          <ul className="space-y-2">
            {rework.map((b) => (
              <li
                key={b.id}
                className="flex flex-wrap items-center gap-3 rounded-2xl border border-amber-500/30 bg-amber-500/10 px-3 py-2.5"
              >
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-amber-500/15 text-amber-600 dark:text-amber-400">
                  <Wrench className="h-4 w-4" />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="truncate font-mono text-sm font-medium text-foreground">
                    {b.boxCode ?? `#${b.boxNumber}`}
                  </div>
                  {b.reason && <div className="truncate text-xs text-muted">{b.reason}</div>}
                </div>
                <Button variant="glass" size="sm" onClick={() => resubmit(b.id)} disabled={resubmitting}>
                  <RotateCcw className="h-4 w-4" /> {t("otp.resubmit")}
                </Button>
              </li>
            ))}
          </ul>
        </GlassCard>
      )}
    </>
  );
}
