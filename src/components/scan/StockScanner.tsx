"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { stockEntry, getStockWaitingCount, type StockDone } from "@/app/(app)/scan/carton-actions";
import { useNotifications } from "@/components/notifications/NotificationsProvider";
import { useT } from "@/lib/i18n";
import { notFoundMessage } from "@/lib/scan/locate";
import { PageHeader } from "@/components/ui/PageHeader";
import { GlassCard } from "@/components/ui/GlassCard";
import { Badge } from "@/components/ui/Badge";
import { ToolScanField } from "./ToolScanField";
import { Warehouse, Hourglass, CheckCircle2, AlertCircle, Boxes, Package } from "lucide-react";

export function StockScanner({
  initialWaiting = 0,
  initialRecent = [],
}: {
  initialWaiting?: number;
  initialRecent?: StockDone[];
}) {
  const t = useT();
  const router = useRouter();
  const { onAny } = useNotifications();

  const [waiting, setWaiting] = useState(initialWaiting);
  const [recent, setRecent] = useState<StockDone[]>(initialRecent);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [okMsg, setOkMsg] = useState<string | null>(null);

  async function refreshWaiting() {
    try {
      setWaiting(await getStockWaitingCount());
    } catch {
      /* ignore */
    }
  }

  // Live: bump the waiting count when a carton/pallet becomes ready for Stock.
  useEffect(() => {
    return onAny((n) => {
      if (n.stage === "stock_entry") void refreshWaiting();
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onAny]);

  async function scan(code: string) {
    const c = code.trim();
    if (!c || busy) return;
    setBusy(true);
    setError(null);
    const res = await stockEntry(c);
    setBusy(false);

    if (res.error || res.reason) {
      setOkMsg(null);
      setError(
        res.reason === "not_found"
          ? await notFoundMessage(t, c, "stock.notFound")
          : res.reason === "already"
            ? t("stock.already")
            : (res.error as string),
      );
      return;
    }
    setError(null);
    const msg = (res.kind === "pallet" ? t("stock.enteredPallet") : t("stock.enteredCarton")).replace("{n}", String(res.count ?? 0));
    setOkMsg(`${res.code ?? ""} · ${msg}`);
    void refreshWaiting();
    router.refresh();
  }

  return (
    <>
      <PageHeader title={t("stock.title")} subtitle={t("stock.subtitle")}>
        <Badge tone="accent" dot>
          {waiting} {t("qc1.waiting")}
        </Badge>
      </PageHeader>

      <div className="mx-auto flex w-full max-w-4xl flex-col gap-4">
        <GlassCard className="">
          <div className="mb-4 flex items-center gap-3">
            <span className="grid h-11 w-11 place-items-center rounded-2xl bg-accent-gradient text-[var(--accent-contrast)] glow">
              <Warehouse className="h-5 w-5" />
            </span>
            <div>
              <h2 className="font-display text-lg font-semibold text-foreground">{t("stage.stock_entry")}</h2>
              <p className="text-xs text-faint">{t("stock.scanHint")}</p>
            </div>
          </div>

          <div className="mb-3 flex items-center justify-between rounded-2xl border border-[var(--border)] bg-[var(--surface-2)] px-4 py-3">
            <span className="flex items-center gap-2 text-sm font-medium text-muted">
              <Hourglass className="h-4 w-4" /> {t("stock.waitingLabel")}
            </span>
            <div className="flex items-center gap-2">
              <span className="font-display text-lg font-semibold text-foreground">{waiting}</span>
              <button onClick={refreshWaiting} className="ring-accent rounded-lg px-2 py-1 text-xs text-muted hover:text-[var(--accent)]">
                {t("qc1.refresh")}
              </button>
            </div>
          </div>

          <ToolScanField onScan={scan} busy={busy} placeholder={t("stock.scanCode")} />

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
        </GlassCard>

        <GlassCard className="">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="font-display text-lg font-semibold text-foreground">{t("stock.recent")}</h3>
            <span className="text-xs text-faint">{recent.length}</span>
          </div>
          {recent.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-[var(--border)] py-10 text-center text-sm text-faint">
              {t("stock.empty")}
            </div>
          ) : (
            <ul className="space-y-2">
              {recent.map((c) => (
                <li key={c.id} className="flex items-center gap-3 rounded-2xl border border-[var(--border)] bg-[var(--surface-2)] px-3 py-2.5">
                  <span className="grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-[var(--accent-soft)] text-[var(--accent)]">
                    <Package className="h-4 w-4" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-mono text-xs text-foreground">{c.code ?? "—"}</div>
                    {c.model && <div className="truncate text-xs text-faint">{c.model}</div>}
                  </div>
                  <Badge tone="success">
                    <Boxes className="me-1 h-3 w-3" /> {c.count}
                  </Badge>
                </li>
              ))}
            </ul>
          )}
        </GlassCard>
      </div>
    </>
  );
}
