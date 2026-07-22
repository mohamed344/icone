"use client";

import { useState } from "react";
import { registerArticle, recordPcbaPass, lookupOperator } from "@/app/(app)/scan/sf-actions";
import { parseScan, type ScanField } from "@/lib/scan/parse-scan";
import { notFoundMessage } from "@/lib/scan/locate";
import { useT, type DictKey } from "@/lib/i18n";
import { GlassCard } from "@/components/ui/GlassCard";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { ToolScanField } from "@/components/scan/ToolScanField";
import { PageHeader } from "@/components/ui/PageHeader";
import { cn } from "@/lib/cn";
import {
  ScanLine,
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  QrCode,
  CircuitBoard,
  RotateCcw,
  Check,
} from "lucide-react";

/** One labelled scan input in the 3-field layout — any field can be used in any
 * order; it highlights on focus and shows a check + value once captured. */
function FieldRow({
  n,
  title,
  value,
  done,
  children,
}: {
  n: number;
  title: string;
  value?: string | null;
  done: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface-2)] p-3 transition-colors focus-within:border-[var(--accent)]/40 focus-within:bg-[var(--accent-soft)]">
      <div className="mb-2 flex items-center gap-2">
        <span
          className={cn(
            "grid h-6 w-6 shrink-0 place-items-center rounded-full text-xs font-semibold",
            done ? "bg-emerald-500 text-white" : "bg-[var(--surface)] text-faint",
          )}
        >
          {done ? <Check className="h-3.5 w-3.5" strokeWidth={3} /> : n}
        </span>
        <span className="text-sm font-medium text-foreground">{title}</span>
        {value && (
          <span className="ms-auto truncate font-mono text-xs font-medium text-emerald-600 dark:text-emerald-400">
            {value}
          </span>
        )}
      </div>
      {children}
    </div>
  );
}

/**
 * A QC QR is a PROBLEM only when it carries a failure marker (NG, FAIL, NOK, …).
 * Anything else — OK/PASS, a plain code, a manual entry — passes. So real QC
 * codes that report a defect are stopped, while everything else moves on.
 */
const isQcProblem = (s: string) =>
  /(^|[^a-z])(ng|nok|ko|fail(ed)?|error|err|reject(ed)?|defect|defaut|défaut|bad|problem|probleme|problème)([^a-z]|$)/i.test(
    s.trim(),
  );

/**
 * Step-one ("Scan PCBA"), one unit at a time — a flat 3-scan flow:
 *  1. QR      → read the N° série (serial number)
 *  2. barcode → capture the operator/creator name (free text)
 *  3. QC QR   → OK/PASS advances the unit; any other content is a QC problem
 *               shown in a modal (the unit stays for a re-scan).
 * Only an OK writes to scan_events (code = serial) via recordScan.
 */
export function SfScanner() {
  const t = useT();
  const [serial, setSerial] = useState<string | null>(null);
  const [creator, setCreator] = useState<string | null>(null);
  const [carteMere, setCarteMere] = useState<ScanField[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [okMsg, setOkMsg] = useState<string | null>(null);
  /** A failing QC QR — its content is shown in a modal. */
  const [problem, setProblem] = useState<string | null>(null);

  function reset() {
    setSerial(null);
    setCreator(null);
    setCarteMere(null);
    setError(null);
    setOkMsg(null);
    setProblem(null);
  }

  async function handleSerial(raw: string) {
    // Accept the serial from the QR or from a plain barcode / typed value — the
    // carte mère carries the N° série as both a QR and a barcode.
    const parsed = parseScan(raw, true);
    const serialCode = parsed.code?.trim();
    if (!serialCode) {
      setError(t("sf.needQr"));
      return;
    }

    setOkMsg(null);
    setBusy(true);
    // Persist the article the moment its serial is read (duplicates rejected).
    const res = await registerArticle({ serial: serialCode, qr: raw.trim() });
    setBusy(false);

    if (res.reason === "already_done") {
      setError(t("sf.alreadyDone"));
      return;
    }
    if (res.reason === "duplicate") {
      setError(t("sf.duplicate").replace("{serial}", serialCode));
      return;
    }
    if (res.error) {
      setError(res.error);
      return;
    }

    setSerial(serialCode);
    // Show the carte-mère fields only when a real QR was scanned.
    setCarteMere(parsed.kind === "qr" ? parsed.fields ?? [] : null);
    // The employee who made the work comes from the QR — auto-fill step 2.
    if (parsed.operator) setCreator(parsed.operator);
    setError(null);
  }

  async function handlePerson(raw: string) {
    const trimmed = raw.trim();
    if (!trimmed) return;

    // A QR badge may carry the operator's name in a labelled field — read it as
    // a string directly instead of treating the whole payload as a code.
    const parsed = parseScan(trimmed, true);
    if (parsed.kind === "qr") {
      const fromQr =
        parsed.operator ??
        parsed.fields?.find((f) => /nom|name|op[ée]rateur|operator|employ|agent/i.test(f.label))?.value;
      if (fromQr) {
        setCreator(fromQr);
        setError(null);
        return;
      }
    }

    // Otherwise resolve the scanned badge value (employee code or name) to a name.
    setBusy(true);
    const { name } = await lookupOperator(trimmed);
    setBusy(false);
    setCreator(name ?? trimmed);
    setError(name ? null : t("sf.operatorUnknown"));
  }

  async function handleVerify(raw: string) {
    // The QC mark can be a QR (with a result field) or a plain code — read either.
    const parsed = parseScan(raw.trim(), true);
    const text = (
      parsed.kind === "qr"
        ? parsed.fields?.find((f) => /result|status|r[ée]sultat|verdict|qc|cq|test/i.test(f.label))?.value ??
          raw.trim()
        : raw.trim()
    ).trim();
    if (!text) return;

    // Only a QC result with a failure marker is a problem — show it (needs no other scan).
    if (isQcProblem(text)) {
      setProblem(text);
      setError(null);
      return;
    }

    // OK → the unit passes, but it needs its serial (and operator) captured first.
    if (!serial) {
      // The value here may be a serial that's already moved on (e.g. waiting at
      // OTP) — locate it and say where it is, else ask for the N° série.
      setError(await notFoundMessage(t, parsed.code || text, "sf.needSerial"));
      return;
    }
    if (!creator) {
      setError(t("sf.needOperator"));
      return;
    }

    setBusy(true);
    const res = await recordPcbaPass({ serial, creator });
    setBusy(false);

    if (res.reason === "already_done") {
      setError(t("sf.alreadyDone"));
      return;
    }
    if (res.error) {
      setError(res.error);
      return;
    }

    const note =
      res.nextStage != null
        ? t("scan.next").replace("{stage}", t(`stage.${res.nextStage}` as DictKey))
        : t("scan.done");
    setOkMsg(t("sf.verified").replace("{note}", note));
    setError(null);
    // Ready for the next unit.
    setSerial(null);
    setCreator(null);
    setCarteMere(null);
  }

  return (
    <>
      <PageHeader title={t("sf.title")} subtitle={t("sf.subtitle")} />
      <div className="mx-auto w-full max-w-4xl">
        <GlassCard>
          <div className="mb-4 flex items-start justify-between gap-3">
            <div className="flex items-center gap-3">
              <span className="grid h-11 w-11 place-items-center rounded-2xl bg-accent-gradient text-[var(--accent-contrast)] glow">
                <ScanLine className="h-5 w-5" />
              </span>
              <div>
                <h2 className="font-display text-lg font-semibold text-foreground">{t("sf.title")}</h2>
                <p className="text-xs text-faint">{t("sf.subtitle")}</p>
              </div>
            </div>
            <Badge tone="accent" dot>
              {t("stage.container_creation")}
            </Badge>
          </div>

          {/* The three scans, all on one screen — usable in any order. */}
          <div className="space-y-3">
            <FieldRow n={1} title={t("sf.serial")} value={serial} done={!!serial}>
              <ToolScanField onScan={handleSerial} busy={busy} placeholder={t("sf.scanQr")} />
            </FieldRow>

            <FieldRow n={2} title={t("sf.creator")} value={creator} done={!!creator}>
              <ToolScanField onScan={handlePerson} busy={busy} autoFocus={false} placeholder={t("sf.scanPerson")} />
            </FieldRow>

            <FieldRow n={3} title={t("sf.step3")} done={false}>
              <ToolScanField onScan={handleVerify} busy={busy} autoFocus={false} placeholder={t("sf.scanVerify")} />
            </FieldRow>
          </div>

          {(serial || creator || okMsg) && (
            <button
              type="button"
              onClick={reset}
              className="mt-3 inline-flex items-center gap-1.5 text-xs font-medium text-faint transition-colors hover:text-foreground"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              {t("sf.reset")}
            </button>
          )}

          {okMsg && (
            <div className="mt-3 flex items-center gap-2 rounded-2xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm font-medium text-emerald-600 dark:text-emerald-400">
              <CheckCircle2 className="h-4 w-4 shrink-0" />
              <span className="truncate">{okMsg}</span>
            </div>
          )}
          {error && (
            <div className="mt-3 flex items-start gap-2 rounded-2xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-600 dark:text-rose-400">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Carte mère data from the QR */}
          {carteMere && carteMere.length > 0 && (
            <div className="mt-4 rounded-2xl border border-[var(--accent)]/30 bg-[var(--accent-soft)] p-4">
              <div className="mb-3 flex items-center gap-2">
                <CircuitBoard className="h-4 w-4 text-[var(--accent)]" />
                <h3 className="font-display text-sm font-semibold text-foreground">{t("scan.carteMere")}</h3>
                <span className="ms-auto inline-flex items-center gap-1 text-xs text-[var(--accent)]">
                  <QrCode className="h-3.5 w-3.5" /> QR
                </span>
              </div>
              <dl className="grid gap-x-6 gap-y-2 sm:grid-cols-2">
                {carteMere.map((f, i) => (
                  <div
                    key={i}
                    className="flex items-baseline justify-between gap-3 border-b border-[var(--border)] pb-1.5"
                  >
                    <dt className="text-xs uppercase tracking-wide text-faint">{f.label || "—"}</dt>
                    <dd className="truncate font-mono text-sm font-medium text-foreground">{f.value}</dd>
                  </div>
                ))}
              </dl>
            </div>
          )}
        </GlassCard>
      </div>

      {/* QC problem — shown when the QC QR isn't OK. Close and re-scan. */}
      <Modal open={!!problem} onClose={() => setProblem(null)} title={t("sf.qcProblemTitle")}>
        {problem && (
          <div className="flex flex-col gap-4">
            <div className="flex items-start gap-3 rounded-2xl border border-rose-500/30 bg-rose-500/10 p-4">
              <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-rose-500" />
              <div className="min-w-0">
                <div className="font-display text-base font-semibold text-rose-600 dark:text-rose-400">
                  {t("sf.problem")}
                </div>
                <p className="mt-1 whitespace-pre-wrap break-words text-sm text-foreground">{problem}</p>
              </div>
            </div>
            <Button onClick={() => setProblem(null)} className="w-full">
              <RotateCcw className="h-4 w-4" /> {t("sf.qcRetry")}
            </Button>
          </div>
        )}
      </Modal>
    </>
  );
}
