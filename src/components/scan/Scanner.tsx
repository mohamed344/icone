"use client";

import { useRef, useState } from "react";
import { recordScan } from "@/app/(app)/scan/actions";
import { STAGE_ENTITY, ENTITY_TYPES, type EntityType, type WorkflowStage } from "@/lib/workflow";
import { parseScan, type ScanField } from "@/lib/scan/parse-scan";
import { useT, type DictKey } from "@/lib/i18n";
import { GlassCard } from "@/components/ui/GlassCard";
import { Button } from "@/components/ui/Button";
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
  entityType?: EntityType;
  /** Operators: lock the entity to the step's default so the screen stays focused. */
  lockEntity?: boolean;
}

export function Scanner({ stages, entityType = "item", lockEntity = false }: ScannerProps) {
  const t = useT();
  const [stageSel, setStageSel] = useState<WorkflowStage>(stages[0] ?? "container_creation");
  const stageLabel = t(`stage.${stageSel}` as DictKey);
  const [entity, setEntity] = useState<EntityType>(entityType);
  const effectiveEntity: EntityType = lockEntity ? STAGE_ENTITY[stageSel] : entity;
  const canSelectStage = stages.length > 1;
  const enableQr = stageSel === "container_creation"; // Scan BF

  const [busy, setBusy] = useState(false);
  const [hasText, setHasText] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [okMsg, setOkMsg] = useState<string | null>(null);
  const [carteMere, setCarteMere] = useState<ScanField[] | null>(null);
  const [rows, setRows] = useState<ScanRow[]>([]);

  const taRef = useRef<HTMLTextAreaElement | null>(null);
  const timerRef = useRef<number | null>(null);

  function pushRow(row: ScanRow) {
    setRows((r) => [row, ...r].slice(0, 12));
  }

  async function submitBarcode(code: string) {
    if (!code || busy) return;
    setBusy(true);
    setError(null);
    const res = await recordScan({ stage: stageSel, code, entityType: effectiveEntity });
    setBusy(false);

    if (res.error || res.reason) {
      const msg =
        res.reason === "out_of_order"
          ? t("scan.outOfOrder").replace(
              "{stage}",
              res.expectedStage ? t(`stage.${res.expectedStage}` as DictKey) : "",
            )
          : res.reason === "step_off"
            ? t("scan.stepOff")
            : res.reason === "completed"
              ? t("scan.completed")
              : (res.error as string);
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
    setHasText(false);
    handleScan(raw);
    el?.focus();
  }

  function scheduleFinalize() {
    if (timerRef.current) clearTimeout(timerRef.current);
    // Wait for the scanner to go idle (handles multi-line QR sent as several Enters).
    timerRef.current = window.setTimeout(finalize, 90);
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    // any keystroke means more input may be coming → cancel a pending finalize
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    if (e.key === "Enter") scheduleFinalize();
  }

  return (
    <div className="grid gap-4 lg:grid-cols-5">
      {/* Scanner */}
      <GlassCard className="lg:col-span-3">
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

        {/* selectors (chef/admin) */}
        {(canSelectStage || !lockEntity) && (
          <div className="mb-3 flex flex-wrap items-center gap-2">
            {canSelectStage && (
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
            )}
            {!lockEntity && (
              <div className="flex items-center gap-2">
                <span className="text-xs text-faint">{t("scan.type")}</span>
                <select
                  value={entity}
                  onChange={(e) => setEntity(e.target.value as EntityType)}
                  className="ring-accent h-9 rounded-xl border border-[var(--border)] bg-[var(--surface-2)] px-3 text-sm capitalize text-foreground focus:border-[var(--accent)]"
                >
                  {ENTITY_TYPES.map((tp) => (
                    <option key={tp} value={tp}>
                      {tp}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>
        )}

        {/* Tool scan field — physical scanner types here */}
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

        {/* Carte mère data (QR), Scan BF only */}
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

      {/* Session log */}
      <GlassCard className="lg:col-span-2">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="font-display text-lg font-semibold text-foreground">{t("scan.session")}</h3>
          <span className="text-xs text-faint">{rows.length}</span>
        </div>
        {rows.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-[var(--border)] py-10 text-center text-sm text-faint">
            {t("scan.empty")}
          </div>
        ) : (
          <ul className="space-y-2">
            {rows.map((r, i) => (
              <li
                key={i}
                className={cn(
                  "flex items-center gap-3 rounded-2xl border px-3 py-2.5",
                  r.ok ? "border-[var(--border)] bg-[var(--surface-2)]" : "border-rose-500/30 bg-rose-500/10",
                )}
              >
                {r.kind === "qr" ? (
                  <QrCode className="h-4 w-4 shrink-0 text-[var(--accent)]" />
                ) : r.ok ? (
                  <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-500" />
                ) : (
                  <AlertCircle className="h-4 w-4 shrink-0 text-rose-500" />
                )}
                <div className="min-w-0 flex-1">
                  <div className="truncate font-mono text-sm text-foreground">{r.code}</div>
                  {r.note && <div className="truncate text-xs text-faint">{r.note}</div>}
                </div>
                <span className="text-xs text-faint">{r.at}</span>
              </li>
            ))}
          </ul>
        )}
      </GlassCard>
    </div>
  );
}
