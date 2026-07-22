"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { findUnitByCarteOrDimo, sendToReparation, type Unit } from "@/app/(app)/scan/unit-actions";
import { useT } from "@/lib/i18n";
import { notFoundMessage } from "@/lib/scan/locate";
import { PageHeader } from "@/components/ui/PageHeader";
import { GlassCard } from "@/components/ui/GlassCard";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Modal } from "@/components/ui/Modal";
import { ToolScanField } from "./ToolScanField";
import { Wrench, AlertCircle, ScanLine, Loader2, ArrowRight } from "lucide-react";

/**
 * NG station: scan a bad product (sitting at Test), describe the problem, and
 * send it to Reparation. There is no pre-filled queue — the operator only scans
 * the products physically rejected at Test.
 */
export function NgScanner() {
  const t = useT();
  const router = useRouter();

  const [target, setTarget] = useState<Unit | null>(null);
  const [code, setCode] = useState("");
  const [problem, setProblem] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [scanErr, setScanErr] = useState<string | null>(null);
  const [okMsg, setOkMsg] = useState<string | null>(null);
  const [, start] = useTransition();

  async function scan(raw: string) {
    const c = raw.trim();
    if (!c) return;
    setScanErr(null);
    setOkMsg(null);
    const unit = await findUnitByCarteOrDimo("scan_test", c);
    if (!unit) {
      setScanErr(await notFoundMessage(t, c, "ng.notFound"));
      return;
    }
    setTarget(unit);
    setCode(c);
    setProblem("");
    setError(null);
  }

  function confirm() {
    if (!target) return;
    if (!problem.trim()) {
      setError(t("ng.reasonRequired"));
      return;
    }
    setBusy(true);
    setError(null);
    start(async () => {
      const res = await sendToReparation(code, problem);
      setBusy(false);
      if (res.error || res.reason) {
        setError(res.reason === "not_found" ? t("ng.notFound") : (res.error as string));
        return;
      }
      setTarget(null);
      setOkMsg(`${res.dimo ?? code} · ${t("ng.sentToReparation")}`);
      router.refresh();
    });
  }

  return (
    <>
      <PageHeader title={t("stage.ng_handling")} subtitle={t("ng.subtitle")}>
        <Badge tone="warning" dot>
          NG
        </Badge>
      </PageHeader>

      <div className="mx-auto w-full max-w-4xl">
        <GlassCard>
          <div className="mb-4 flex items-center gap-3">
            <span className="grid h-11 w-11 place-items-center rounded-2xl bg-amber-500/15 text-amber-600 dark:text-amber-400">
              <ScanLine className="h-5 w-5" />
            </span>
            <div>
              <h2 className="font-display text-lg font-semibold text-foreground">{t("stage.ng_handling")}</h2>
              <p className="text-xs text-faint">{t("ng.scanHint")}</p>
            </div>
          </div>
          <ToolScanField onScan={scan} placeholder={t("ng.scanProduct")} />

          {okMsg && (
            <div className="mt-3 flex items-center gap-2 rounded-2xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm font-medium text-emerald-600 dark:text-emerald-400">
              <ArrowRight className="h-4 w-4 shrink-0 flip-rtl" />
              <span className="truncate">{okMsg}</span>
            </div>
          )}
          {scanErr && (
            <div className="mt-3 flex items-start gap-2 rounded-2xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-600 dark:text-rose-400">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{scanErr}</span>
            </div>
          )}
        </GlassCard>
      </div>

      {/* Describe the problem, then send to Reparation */}
      <Modal open={!!target} onClose={() => setTarget(null)} title={t("ng.decision")}>
        {target && (
          <div className="flex flex-col gap-4">
            <div className="flex items-center gap-3 rounded-2xl border border-[var(--border)] bg-[var(--surface-2)] p-3.5">
              <span className="grid h-11 w-11 place-items-center rounded-xl bg-amber-500/15 text-amber-600 dark:text-amber-400">
                <Wrench className="h-5 w-5" />
              </span>
              <div className="min-w-0">
                <div className="truncate font-mono text-sm font-semibold text-foreground">{target.dimo ?? target.serial}</div>
                {target.product && <div className="truncate text-xs text-faint">{target.product}</div>}
              </div>
            </div>

            <label className="block">
              <span className="mb-1.5 block text-sm font-medium text-muted">{t("ng.problem")}</span>
              <textarea
                value={problem}
                onChange={(e) => setProblem(e.target.value)}
                rows={3}
                autoFocus
                placeholder={t("ng.problemPlaceholder")}
                className="ring-accent w-full resize-y rounded-2xl border border-[var(--border)] bg-[var(--surface-2)] p-3 text-sm text-foreground placeholder:text-faint focus:border-[var(--accent)]"
              />
            </label>

            {error && (
              <div className="flex items-start gap-2 rounded-2xl border border-rose-500/30 bg-rose-500/10 px-3 py-2.5 text-sm text-rose-600 dark:text-rose-400">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <div className="flex gap-2">
              <Button onClick={confirm} disabled={busy} className="flex-1 !bg-amber-500">
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowRight className="h-4 w-4 flip-rtl" />}
                {t("ng.toReparation")}
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
