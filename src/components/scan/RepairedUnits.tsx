"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { getRepairedUnits, reReceiveUnit, type Unit } from "@/app/(app)/scan/unit-actions";
import { useNotifications } from "@/components/notifications/NotificationsProvider";
import { useT } from "@/lib/i18n";
import { GlassCard } from "@/components/ui/GlassCard";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Wrench, RotateCcw, Loader2 } from "lucide-react";

/** Units returned from NG repair, awaiting re-reception (the loop closes here). */
export function RepairedUnits({ initial }: { initial: Unit[] }) {
  const t = useT();
  const router = useRouter();
  const { onAny } = useNotifications();

  const [units, setUnits] = useState<Unit[]>(initial);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [, start] = useTransition();

  async function refresh() {
    try {
      setUnits(await getRepairedUnits());
    } catch {
      /* ignore */
    }
  }

  useEffect(() => {
    return onAny((n) => {
      if (n.stage === "reception") void refresh();
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onAny]);

  function reReceive(u: Unit) {
    setBusyId(u.id);
    start(async () => {
      const res = await reReceiveUnit(u.id);
      setBusyId(null);
      if (res.ok) {
        setUnits((list) => list.filter((x) => x.id !== u.id));
        router.refresh();
      }
    });
  }

  if (units.length === 0) return null;

  return (
    <GlassCard padded={false} className="overflow-hidden">
      <div className="flex items-center gap-2 border-b border-[var(--border)] px-5 py-3">
        <Wrench className="h-5 w-5 text-amber-500" />
        <h3 className="font-display font-semibold text-foreground">{t("reception.repaired")}</h3>
        <Badge tone="warning">{units.length}</Badge>
      </div>
      <ul className="divide-y divide-[var(--border)]">
        {units.map((u) => (
          <li key={u.id} className="flex items-center gap-3 px-5 py-3">
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-amber-500/15 text-amber-600 dark:text-amber-400">
              <Wrench className="h-4 w-4" />
            </span>
            <div className="min-w-0 flex-1">
              <div className="truncate font-mono text-sm text-foreground">{u.serial}</div>
              {u.product && <div className="truncate text-xs text-faint">{u.product}</div>}
            </div>
            <Button size="sm" onClick={() => reReceive(u)} disabled={busyId === u.id}>
              {busyId === u.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <RotateCcw className="h-4 w-4" />}
              {t("reception.reReceive")}
            </Button>
          </li>
        ))}
      </ul>
    </GlassCard>
  );
}
