"use client";

import { useT, type DictKey } from "@/lib/i18n";
import { PageHeader } from "@/components/ui/PageHeader";
import { GlassCard } from "@/components/ui/GlassCard";
import { AreaChart } from "@/components/charts/AreaChart";
import { BarChart } from "@/components/charts/BarChart";
import type { ScanStats, StockStats } from "@/lib/admin/stats";
import { Activity, Timer, TrendingUp, Crown, Warehouse, Package, Layers, PackageCheck } from "lucide-react";

function Tile({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <GlassCard className="flex items-center gap-3">
      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[var(--accent-soft)] text-[var(--accent)]">
        {icon}
      </span>
      <div className="min-w-0">
        <div className="truncate font-display text-xl font-semibold text-foreground">{value}</div>
        <div className="truncate text-xs text-faint">{label}</div>
      </div>
    </GlassCard>
  );
}

export function AdminAnalytics({ stats, stock }: { stats: ScanStats; stock: StockStats }) {
  const t = useT();

  const busiest = [...stats.perStep].sort((a, b) => b.count - a.count)[0];
  const topEmp = stats.perEmployee[0];
  const maxEmp = Math.max(1, ...stats.perEmployee.map((e) => e.count));

  return (
    <>
      <PageHeader title={t("analytics.title")} subtitle={t("analytics.subtitle")} />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Tile icon={<Activity className="h-5 w-5" />} label={`${stats.daysCount} ${t("stats.days")}`} value={stats.windowTotal.toLocaleString()} />
        <Tile icon={<Timer className="h-5 w-5" />} label={t("stats.avgGap")} value={`${stats.avgGapMin} ${t("stats.minutesShort")}`} />
        <Tile icon={<TrendingUp className="h-5 w-5" />} label={t("stats.busiestStep")} value={busiest ? t(`stage.${busiest.stage}` as DictKey) : "—"} />
        <Tile icon={<Crown className="h-5 w-5" />} label={t("stats.topEmployee")} value={topEmp ? topEmp.name : "—"} />
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Tile icon={<Warehouse className="h-5 w-5" />} label={t("stats.inStock")} value={stock.inStock.toLocaleString()} />
        <Tile icon={<Package className="h-5 w-5" />} label={t("stats.cartons")} value={stock.cartons.toLocaleString()} />
        <Tile icon={<Layers className="h-5 w-5" />} label={t("stats.pallets")} value={stock.pallets.toLocaleString()} />
        <Tile icon={<PackageCheck className="h-5 w-5" />} label={t("stats.stockedToday")} value={stock.enteredToday.toLocaleString()} />
      </div>

      <GlassCard>
        <h3 className="mb-1 font-display text-lg font-semibold text-foreground">{t("stats.scansPerDay")}</h3>
        <p className="mb-4 text-xs text-faint">{`${stats.daysCount} ${t("stats.days")}`}</p>
        {stats.windowTotal === 0 ? (
          <div className="rounded-2xl border border-dashed border-[var(--border)] py-12 text-center text-sm text-faint">{t("stats.noData")}</div>
        ) : (
          <AreaChart labels={stats.daily.labels} current={stats.daily.values} />
        )}
      </GlassCard>

      <div className="grid gap-4 lg:grid-cols-2">
        <GlassCard>
          <h3 className="mb-4 font-display text-lg font-semibold text-foreground">{t("stats.perStep")}</h3>
          <BarChart
            labels={stats.perStep.map((s) => t(`stage.${s.stage}` as DictKey))}
            values={stats.perStep.map((s) => s.count)}
          />
        </GlassCard>

        <GlassCard>
          <h3 className="mb-4 font-display text-lg font-semibold text-foreground">{t("stats.byEmployee")}</h3>
          {stats.perEmployee.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-[var(--border)] py-10 text-center text-sm text-faint">{t("stats.noData")}</div>
          ) : (
            <ul className="space-y-3">
              {stats.perEmployee.map((e) => (
                <li key={e.name}>
                  <div className="mb-1.5 flex items-center justify-between text-sm">
                    <span className="truncate text-muted">{e.name}</span>
                    <span className="font-medium text-foreground">{e.count}</span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-[var(--surface-2)]">
                    <div className="h-full rounded-full bg-accent-gradient" style={{ width: `${(e.count / maxEmp) * 100}%` }} />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </GlassCard>
      </div>
    </>
  );
}
