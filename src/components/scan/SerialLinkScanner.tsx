"use client";

import { useState } from "react";
import { linkCarteDimo, checkCarteForBinding } from "@/app/(app)/scan/unit-actions";
import { useT, type DictKey } from "@/lib/i18n";
import { parseScan } from "@/lib/scan/parse-scan";
import { notFoundMessage } from "@/lib/scan/locate";
import { GlassCard } from "@/components/ui/GlassCard";
import { Badge } from "@/components/ui/Badge";
import { ToolScanField } from "@/components/scan/ToolScanField";
import { PageHeader } from "@/components/ui/PageHeader";
import { emitScanPassed } from "@/lib/scan/pass-event";
import { cn } from "@/lib/cn";
import { ScanLine, CheckCircle2, AlertCircle, AlertTriangle, Cpu, Link2, RotateCcw } from "lucide-react";

type Phase = "carte" | "dimo";

/**
 * Container codes (a closed OTP box / carton / pallet) — e.g. Icone-Box2026…,
 * Icone-Carton2026…. Binding matches a carte to a dimo, so these must be
 * rejected: only the carte and dimo barcodes belong here.
 */
const isContainerCode = (code: string) => /^\s*icone-(box|carton|pallet)/i.test(code);

interface LinkRow {
  carte: string;
  dimo: string;
  at: string;
  ok: boolean;
  note?: string;
}

/**
 * Binding (serial_linking) two-scan wizard: scan the carte (the unit serial
 * flowing from Scan PCBA) then the dimo barcode. The pair is persisted 1:1 via
 * linkCarteDimo, which advances the unit to the next step.
 */
export function SerialLinkScanner() {
  const t = useT();
  const [phase, setPhase] = useState<Phase>("carte");
  const [carte, setCarte] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [verdict, setVerdict] = useState<{ ok: boolean; detail: string } | null>(null);
  const [rows, setRows] = useState<LinkRow[]>([]);

  function pushRow(row: LinkRow) {
    setRows((r) => [row, ...r].slice(0, 100));
  }

  function reset() {
    setPhase("carte");
    setCarte(null);
    setError(null);
    setVerdict(null);
  }

  async function handleCarte(raw: string) {
    // The carte carries its serial as a QR (with the serial inside) — extract it.
    const code = parseScan(raw, true).code.trim();
    if (!code) return;
    // A box/carton barcode is not a carte — reject it here, don't advance.
    if (isContainerCode(raw.trim()) || isContainerCode(code)) {
      setError(t("link.boxNotAllowed"));
      setVerdict(null);
      return;
    }

    // Validate the carte on THIS first scan — flag a wrong serial (already passed
    // Binding, or not yet arrived) immediately, without needing the dimo scan.
    setBusy(true);
    const chk = await checkCarteForBinding(code);
    setBusy(false);
    if (chk.error) {
      setError(chk.error);
      setVerdict(null);
      return;
    }
    if (chk.reason === "not_here") {
      const msg = (await notFoundMessage(t, code, "link.carteNotFound")).replace("{carte}", code);
      setError(msg);
      setVerdict(null);
      return; // stay on the carte field
    }

    setCarte(code);
    setError(null);
    setVerdict(null);
    setPhase("dimo");
  }

  async function handleDimo(raw: string) {
    const dimo = raw.trim();
    if (!dimo || !carte) return;
    // Guard the dimo scan too: a box/carton barcode must never become a dimo.
    if (isContainerCode(dimo)) {
      setError(t("link.boxNotAllowed"));
      setVerdict(null);
      return;
    }

    setBusy(true);
    const res = await linkCarteDimo(carte, dimo);
    setBusy(false);

    if (res.reason === "carte_not_found") {
      // The carte isn't waiting at Binding — tell the operator where it is, then
      // start over from the carte scan.
      const msg = (await notFoundMessage(t, carte, "link.carteNotFound")).replace("{carte}", carte);
      setError(msg);
      setVerdict(null);
      setPhase("carte");
      setCarte(null);
      return;
    }
    if (res.reason === "duplicate") {
      const msg = t("link.duplicate");
      setVerdict({ ok: false, detail: msg });
      setError(null);
      pushRow({ carte, dimo, at: new Date().toLocaleTimeString(), ok: false, note: msg });
      return; // stay on dimo so the operator can re-scan
    }
    if (res.error) {
      setVerdict({ ok: false, detail: res.error });
      setError(null);
      return;
    }

    const note =
      res.nextStage != null
        ? t("scan.next").replace("{stage}", t(`stage.${res.nextStage}` as DictKey))
        : t("scan.done");
    pushRow({ carte, dimo, at: new Date().toLocaleTimeString(), ok: true, note });
    setVerdict({ ok: true, detail: t("link.linked").replace("{note}", note) });
    setError(null);
    emitScanPassed(); // unit advanced → refresh the supervisor's waiting panel now
    // Ready for the next unit.
    setPhase("carte");
    setCarte(null);
  }

  const hintKey: DictKey = phase === "carte" ? "link.step1Hint" : "link.step2Hint";

  return (
    <>
      <PageHeader title={t("link.title")} subtitle={t("link.subtitle")} />
      <div className="mx-auto flex w-full max-w-4xl flex-col gap-4">
        {/* Wizard */}
        <GlassCard className="">
          <div className="mb-4 flex items-start justify-between gap-3">
            <div className="flex items-center gap-3">
              <span className="grid h-11 w-11 place-items-center rounded-2xl bg-accent-gradient text-[var(--accent-contrast)] glow">
                <ScanLine className="h-5 w-5" />
              </span>
              <div>
                <h2 className="font-display text-lg font-semibold text-foreground">{t("link.title")}</h2>
                <p className="text-xs text-faint">{t(hintKey)}</p>
              </div>
            </div>
            <Badge tone="accent" dot>
              {t("stage.serial_linking")}
            </Badge>
          </div>

          {/* Two large scan fields — scan the carte, then its dimo, to match them */}
          <div className="flex flex-col gap-5">
            {/* 1. Carte */}
            <div>
              <div className="mb-2 flex items-center justify-between gap-2">
                <span className="flex items-center gap-2 text-base font-semibold text-foreground">
                  <span className="grid h-8 w-8 place-items-center rounded-xl bg-[var(--accent-soft)] text-[var(--accent)]">
                    <Cpu className="h-4 w-4" />
                  </span>
                  1. {t("link.carte")}
                </span>
                {carte && (
                  <span className="inline-flex min-w-0 items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-xs font-medium text-emerald-600 dark:text-emerald-400">
                    <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
                    <span className="truncate font-mono">{carte}</span>
                  </span>
                )}
              </div>
              <ToolScanField
                busy={busy}
                autoFocus={phase === "carte"}
                placeholder={t("link.scanCarte")}
                onScan={handleCarte}
              />
            </div>

            {/* 2. Dimo — enabled once the carte is captured */}
            <div className={cn("transition-opacity", !carte && "opacity-60")}>
              <div className="mb-2 flex items-center gap-2 text-base font-semibold text-foreground">
                <span className="grid h-8 w-8 place-items-center rounded-xl bg-[var(--accent-soft)] text-[var(--accent)]">
                  <Link2 className="h-4 w-4" />
                </span>
                2. {t("link.dimo")}
              </div>
              <ToolScanField
                busy={busy}
                disabled={!carte}
                autoFocus={phase === "dimo"}
                placeholder={t("link.scanDimo")}
                onScan={handleDimo}
              />
            </div>
          </div>

          {(phase !== "carte" || verdict) && (
            <button
              type="button"
              onClick={reset}
              className="mt-3 inline-flex items-center gap-1.5 text-xs font-medium text-faint transition-colors hover:text-foreground"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              {t("link.reset")}
            </button>
          )}

          {/* OK / PROBLEM verdict */}
          {verdict && (
            <div
              className={cn(
                "mt-3 rounded-2xl border px-4 py-3",
                verdict.ok ? "border-emerald-500/30 bg-emerald-500/10" : "border-rose-500/30 bg-rose-500/10",
              )}
            >
              <div className="flex items-center gap-2">
                {verdict.ok ? (
                  <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-500" />
                ) : (
                  <AlertTriangle className="h-5 w-5 shrink-0 text-rose-500" />
                )}
                <span
                  className={cn(
                    "font-display text-base font-semibold",
                    verdict.ok
                      ? "text-emerald-600 dark:text-emerald-400"
                      : "text-rose-600 dark:text-rose-400",
                  )}
                >
                  {verdict.ok ? t("link.ok") : t("link.problem")}
                </span>
              </div>
              <p className="mt-1 ps-7 text-sm text-foreground">{verdict.detail}</p>
            </div>
          )}
          {error && (
            <div className="mt-3 flex items-start gap-2 rounded-2xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-600 dark:text-rose-400">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}
        </GlassCard>
      </div>
    </>
  );
}
