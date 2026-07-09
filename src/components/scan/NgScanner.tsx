"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { getUnitQueue, repairUnit, type Unit } from "@/app/(app)/scan/unit-actions";
import { useNotifications } from "@/components/notifications/NotificationsProvider";
import { useT } from "@/lib/i18n";
import { PageHeader } from "@/components/ui/PageHeader";
import { GlassCard } from "@/components/ui/GlassCard";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Wrench, RotateCcw, Loader2 } from "lucide-react";

export function NgScanner({ initialQueue }: { initialQueue: Unit[] }) {
  const t = useT();
  const router = useRouter();
  const { onAny } = useNotifications();

  const [queue, setQueue] = useState<Unit[]>(initialQueue);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [, start] = useTransition();

  async function refresh() {
    try {
      setQueue(await getUnitQueue("ng_handling"));
    } catch {
      /* ignore */
    }
  }

  useEffect(() => {
    return onAny((n) => {
      if (n.stage === "ng_handling") void refresh();
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onAny]);

  function repair(unit: Unit) {
    setBusyId(unit.id);
    start(async () => {
      const res = await repairUnit(unit.id);
      setBusyId(null);
      if (res.ok) {
        setQueue((q) => q.filter((u) => u.id !== unit.id));
        router.refresh();
      }
    });
  }

  return (
    <>
      <PageHeader title={t("stage.ng_handling")} subtitle={t("ng.subtitle")}>
        <Badge tone="warning" dot>
          {queue.length} {t("qc1.waiting")}
        </Badge>
      </PageHeader>

      <GlassCard padded={false} className="overflow-hidden">
        <div className="flex items-center justify-between border-b border-[var(--border)] px-5 py-3">
          <div className="flex items-center gap-2">
            <Wrench className="h-5 w-5 text-amber-500" />
            <h3 className="font-display font-semibold text-foreground">{t("ng.queue")}</h3>
          </div>
          <button onClick={refresh} className="ring-accent rounded-lg px-2 py-1 text-xs text-muted hover:text-[var(--accent)]">
            {t("qc1.refresh")}
          </button>
        </div>
        {queue.length === 0 ? (
          <div className="py-12 text-center text-sm text-faint">{t("ng.empty")}</div>
        ) : (
          <ul className="divide-y divide-[var(--border)]">
            {queue.map((u) => (
              <li key={u.id} className="flex flex-wrap items-center gap-3 px-5 py-3">
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-amber-500/15 text-amber-600 dark:text-amber-400">
                  <Wrench className="h-4 w-4" />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="truncate font-mono text-sm text-foreground">{u.serial}</div>
                  {u.problemReason && <div className="truncate text-xs text-muted">{u.problemReason}</div>}
                </div>
                <Button size="sm" onClick={() => repair(u)} disabled={busyId === u.id}>
                  {busyId === u.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <RotateCcw className="h-4 w-4" />}
                  {t("ng.repair")}
                </Button>
              </li>
            ))}
          </ul>
        )}
      </GlassCard>
    </>
  );
}
