"use client";

import { useEffect, useRef, useState } from "react";
import { recordScan, getTodayStageScans } from "@/app/(app)/scan/actions";
import { STAGE_ENTITY, type EntityType, type WorkflowStage } from "@/lib/workflow";
import { parseScan, type ScanField } from "@/lib/scan/parse-scan";
import { seqScanErrorMessage } from "@/lib/scan/scan-error";
import { useT, type DictKey } from "@/lib/i18n";
import { GlassCard } from "@/components/ui/GlassCard";
import { Badge } from "@/components/ui/Badge";
import { cn } from "@/lib/cn";
import {
  ScanLine,
  CheckCircle2,
  AlertCircle,
  Keyboard,
  Loader2,
  ArrowRight,
  CircuitBoard,
  QrCode,
} from "lucide-react";

interface ScanRow {
  code: string;
  at: string;
  ok: boolean;
  kind: "qr" | "barcode";
  note?: string;
}

interface ScannerProps {
  /** Stations this user may scan. One → locked; many → a step picker appears. */
  stages: WorkflowStage[];
}

export function Scanner({ stages }: ScannerProps) {
  const t = useT();
  const [stageSel, setStageSel] = useState<WorkflowStage>(stages[0] ?? "container_creation");
  const stageLabel = t(`stage.${stageSel}` as DictKey);
  // Entity type is derived automatically from the selected step (audit-only field).
  const effectiveEntity: EntityType = STAGE_ENTITY[stageSel];
  const canSelectStage = stages.length > 1;
  const enableQr = stageSel === "container_creation"; // Scan PCBA (step one)

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [okMsg, setOkMsg] = useState<string | null>(null);
  const [carteMere, setCarteMere] = useState<ScanField[] | null>(null);
  const [rows, setRows] = useState<ScanRow[]>([]);

  const taRef = useRef<HTMLTextAreaElement | null>(null);
  const timerRef = useRef<number | null>(null);

  // Load today's scans for the selected station so the log survives navigation.
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const today = await getTodayStageScans(stageSel);
      if (cancelled) return;
      setRows(
        today.map((r) => ({
          code: r.code,
          at: new Date(r.at).toLocaleTimeString(),
          ok: !["fail", "non_conform", "rejected"].includes(r.result),
          kind: "barcode" as const,
        })),
      );
    })();
    return () => {
      cancelled = true;
    };
  }, [stageSel]);

  function pushRow(row: ScanRow) {
    setRows((r) => [row, ...r].slice(0, 100));
  }

  async function submitBarcode(code: string) {
    if (!code || busy) return;
    setBusy(true);
    setError(null);
    const res = await recordScan({ stage: stageSel, code, entityType: effectiveEntity });
    setBusy(false);

    if (res.error || res.reason) {
      const msg = seqScanErrorMessage(t, res);
      setError(msg);
      setOkMsg(null);
      pushRow({ code, at: new Date().toLocaleTimeString(), ok: false, kind: "barcode", note: msg });
      return;
    }

    const note =
      res.nextStage != null
        ? t("scan.next").replace("{stage}", t(`stage.${res.nextStage}` as DictKey))
        : t("scan.done");
    setError(null);
    setOkMsg(`${code} · ${note}`);
    pushRow({ code, at: new Date().toLocaleTimeString(), ok: true, kind: "barcode", note });
  }

  function handleScan(raw: string) {
    const trimmed = raw.trim();
    if (!trimmed) return;
    const parsed = parseScan(trimmed, enableQr);

    if (parsed.kind === "qr") {
      setCarteMere(parsed.fields ?? []);
      setError(null);
      setOkMsg(null);
      pushRow({
        code: parsed.code,
        at: new Date().toLocaleTimeString(),
        ok: true,
        kind: "qr",
        note: t("scan.qrShown"),
      });
    } else {
      void submitBarcode(parsed.code);
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
    handleScan(raw);
    el?.focus();
  }

  function scheduleFinalize(delay = 90) {
    if (timerRef.current) clearTimeout(timerRef.current);
    // Wait for the scanner to go idle (handles multi-line QR sent as several Enters).
    timerRef.current = window.setTimeout(finalize, delay);
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    // any keystroke means more input may be coming → cancel a pending finalize
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    if (e.key !== "Enter") return;
    if (enableQr) {
      // A QR payload can arrive as several Enter-separated lines — wait for the
      // scanner to go idle before reading the whole textarea.
      scheduleFinalize();
    } else {
      // Single-line barcode: the Enter terminator means the scan is complete.
      // Submit immediately instead of waiting out the idle debounce.
      e.preventDefault();
      finalize();
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-4">
      {/* Scanner */}
      <GlassCard className="">
        <div className="mb-4 flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="grid h-11 w-11 place-items-center rounded-2xl bg-accent-gradient text-[var(--accent-contrast)] glow">
              <ScanLine className="h-5 w-5" />
            </span>
            <div>
              <h2 className="font-display text-lg font-semibold text-foreground">{stageLabel}</h2>
              <p className="text-xs text-faint">{enableQr ? t("scan.toolHint") : t("scan.prompt")}</p>
            </div>
          </div>
          <Badge tone="accent" dot>
            {stageLabel}
          </Badge>
        </div>

        {/* Step picker — only when the user may scan more than one station */}
        {canSelectStage && (
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-2">
              <span className="text-xs text-faint">{t("scan.stageLabel")}</span>
              <select
                value={stageSel}
                onChange={(e) => {
                  setStageSel(e.target.value as WorkflowStage);
                  setCarteMere(null);
                  setOkMsg(null);
                  setError(null);
                }}
                className="ring-accent h-9 rounded-xl border border-[var(--border)] bg-[var(--surface-2)] px-3 text-sm text-foreground focus:border-[var(--accent)]"
              >
                {stages.map((s) => (
                  <option key={s} value={s}>
                    {t(`stage.${s}` as DictKey)}
                  </option>
                ))}
              </select>
            </div>
          </div>
        )}

        {/* Tool scan field — physical scanner types here; scans auto-submit */}
        <div className="relative">
          <Keyboard className="pointer-events-none absolute start-5 top-1/2 h-6 w-6 -translate-y-1/2 text-faint" />
          <textarea
            ref={taRef}
            rows={1}
            wrap="off"
            onKeyDown={onKeyDown}
            onChange={() => scheduleFinalize(200)}
            placeholder={t("scan.scanHere")}
            autoFocus
            spellCheck={false}
            className="ring-accent h-20 w-full resize-none overflow-hidden truncate rounded-2xl border border-[var(--border)] bg-[var(--surface-2)] py-6 ps-14 pe-14 font-mono text-xl text-foreground placeholder:text-faint focus:border-[var(--accent)]"
          />
          {busy && (
            <Loader2 className="absolute end-5 top-1/2 h-6 w-6 -translate-y-1/2 animate-spin text-[var(--accent)]" />
          )}
        </div>

        {okMsg && (
          <div className="mt-3 flex items-center gap-2 rounded-2xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm font-medium text-emerald-600 dark:text-emerald-400">
            <CheckCircle2 className="h-4 w-4 shrink-0" />
            <ArrowRight className="h-4 w-4 shrink-0 flip-rtl" />
            <span className="truncate">{okMsg}</span>
          </div>
        )}
        {error && (
          <div className="mt-3 flex items-start gap-2 rounded-2xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-600 dark:text-rose-400">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Carte mère data (QR), Scan PCBA only */}
        {enableQr && carteMere && (
          <div className="mt-4 rounded-2xl border border-[var(--accent)]/30 bg-[var(--accent-soft)] p-4">
            <div className="mb-3 flex items-center gap-2">
              <CircuitBoard className="h-4 w-4 text-[var(--accent)]" />
              <h3 className="font-display text-sm font-semibold text-foreground">{t("scan.carteMere")}</h3>
              <span className="ms-auto inline-flex items-center gap-1 text-xs text-[var(--accent)]">
                <QrCode className="h-3.5 w-3.5" /> QR
              </span>
            </div>
            {carteMere.length === 0 ? (
              <p className="text-sm text-faint">{t("scan.noData")}</p>
            ) : (
              <dl className="grid gap-x-6 gap-y-2 sm:grid-cols-2">
                {carteMere.map((f, i) => (
                  <div key={i} className="flex items-baseline justify-between gap-3 border-b border-[var(--border)] pb-1.5">
                    <dt className="text-xs uppercase tracking-wide text-faint">{f.label || "—"}</dt>
                    <dd className="truncate font-mono text-sm font-medium text-foreground">{f.value}</dd>
                  </div>
                ))}
              </dl>
            )}
          </div>
        )}
      </GlassCard>

    </div>
  );
}
