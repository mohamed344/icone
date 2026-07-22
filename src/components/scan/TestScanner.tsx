"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getUnitQueue, passTest, type Unit } from "@/app/(app)/scan/unit-actions";
import { useNotifications } from "@/components/notifications/NotificationsProvider";
import { useT, type DictKey } from "@/lib/i18n";
import { notFoundMessage } from "@/lib/scan/locate";
import { PageHeader } from "@/components/ui/PageHeader";
import { GlassCard } from "@/components/ui/GlassCard";
import { Badge } from "@/components/ui/Badge";
import { ToolScanField } from "./ToolScanField";
import { cn } from "@/lib/cn";
import { CheckCircle2, AlertCircle, ScanLine } from "lucide-react";

interface TestRow {
  code: string;
  at: string;
  ok: boolean;
  note?: string;
}

/**
 * Test station: the operator scans the DIMO barcode of each good product (the
 * carte serial is not accepted here); it advances to Reprint. There is no OK/NG
 * decision — bad products are taken to the NG station, which pulls them from here.
 */
export function TestScanner({ initialQueue }: { initialQueue: Unit[] }) {
  const t = useT();
  const router = useRouter();
  const { onAny } = useNotifications();

  const [queue, setQueue] = useState<Unit[]>(initialQueue);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [okMsg, setOkMsg] = useState<string | null>(null);
  const [rows, setRows] = useState<TestRow[]>([]);

  async function refresh() {
    try {
      setQueue(await getUnitQueue("scan_test"));
    } catch {
      /* ignore */
    }
  }

  useEffect(() => {
    return onAny((n) => {
      if (n.stage === "scan_test") void refresh();
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onAny]);

  async function scan(code: string) {
    const c = code.trim();
    if (!c || busy) return;
    setBusy(true);
    setError(null);
    const res = await passTest(c);
    setBusy(false);

    if (res.reason === "use_dimo") {
      // Operator scanned the carte serial — Test accepts the dimo only.
      const msg = t("test.useDimo");
      setError(msg);
      setOkMsg(null);
      setRows((r) => [{ code: c, at: new Date().toLocaleTimeString(), ok: false, note: msg }, ...r].slice(0, 100));
      return;
    }
    if (res.reason === "not_found") {
      const msg = await notFoundMessage(t, c, "test.notFound");
      setError(msg);
      setOkMsg(null);
      setRows((r) => [{ code: c, at: new Date().toLocaleTimeString(), ok: false, note: msg }, ...r].slice(0, 100));
      return;
    }
    if (res.error) {
      setError(res.error);
      setOkMsg(null);
      return;
    }

    const note =
      res.nextStage != null
        ? t("scan.next").replace("{stage}", t(`stage.${res.nextStage}` as DictKey))
        : t("scan.done");
    // Show the dimo (the product's label the operator scanned), not the carte serial.
    const shown = res.dimo ?? c;
    setOkMsg(`${shown} · ${note}`);
    setError(null);
    setRows((r) => [{ code: shown, at: new Date().toLocaleTimeString(), ok: true, note }, ...r].slice(0, 100));
    setQueue((q) => q.filter((u) => u.serial !== res.serial));
    router.refresh();
  }

  return (
    <>
      <PageHeader title={t("stage.scan_test")} subtitle={t("test.subtitle")}>
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
              <h2 className="font-display text-lg font-semibold text-foreground">{t("stage.scan_test")}</h2>
              <p className="text-xs text-faint">{t("test.scanHint")}</p>
            </div>
          </div>
          <ToolScanField onScan={scan} busy={busy} placeholder={t("test.scanDimo")} />

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

          {rows.length > 0 && (
            <ul className="mt-4 space-y-2">
              {rows.map((r, i) => (
                <li
                  key={i}
                  className={cn(
                    "flex items-center gap-3 rounded-2xl border px-3 py-2.5",
                    r.ok ? "border-[var(--border)] bg-[var(--surface-2)]" : "border-rose-500/30 bg-rose-500/10",
                  )}
                >
                  {r.ok ? (
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
    </>
  );
}
