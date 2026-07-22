"use client";

import { useT, type DictKey } from "@/lib/i18n";
import { PageHeader } from "@/components/ui/PageHeader";
import { GlassCard } from "@/components/ui/GlassCard";
import { Badge } from "@/components/ui/Badge";
import { Avatar } from "@/components/ui/Avatar";
import { AreaChart } from "@/components/charts/AreaChart";
import { Sparkline } from "@/components/charts/Sparkline";
import type { ScanStats, StockStats } from "@/lib/admin/stats";
import type { Movement } from "@/app/(app)/scan/carton-actions";
import { ScanLine, Users, Timer, Activity, Warehouse, Package, Layers, PackageCheck, LogOut, LogIn } from "lucide-react";
import { cn } from "@/lib/cn";

function Tile({
  icon,
  label,
  value,
  caption,
  spark,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  caption?: string;
  spark?: number[];
}) {
  return (
    <GlassCard interactive className="flex flex-col gap-3">
      <div className="flex items-center gap-2.5">
        <span className="grid h-9 w-9 place-items-center rounded-xl bg-[var(--accent-soft)] text-[var(--accent)]">
          {icon}
        </span>
        <span className="text-sm font-medium text-muted">{label}</span>
      </div>
      <div className="flex items-end justify-between gap-2">
        <div>
          <div className="font-display text-3xl font-semibold tracking-tight text-foreground">{value}</div>
          {caption && <div className="mt-0.5 text-xs text-faint">{caption}</div>}
        </div>
        {spark && spark.some((v) => v > 0) && <Sparkline data={spark} className="opacity-90" />}
      </div>
    </GlassCard>
  );
}

function initials(name: string) {
  const p = name.trim().split(/\s+/);
  return ((p[0]?.[0] ?? "") + (p[1]?.[0] ?? "")).toUpperCase() || "—";
}

export function AdminDashboard({
  stats,
  stock,
  movements,
}: {
  stats: ScanStats;
  stock: StockStats;
  movements: Movement[];
}) {
  const t = useT();
  const spark = stats.daily.values.slice(-9);

  return (
    <>
      <PageHeader title={t("dash.title")} subtitle={t("dash.subtitle")} />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Tile icon={<ScanLine className="h-4 w-4" />} label={t("stats.scansToday")} value={String(stats.totalToday)} spark={spark} />
        <Tile icon={<Users className="h-4 w-4" />} label={t("stats.activeEmployees")} value={String(stats.activeToday)} caption={t("common.today")} />
        <Tile icon={<Timer className="h-4 w-4" />} label={t("stats.avgGap")} value={`${stats.avgGapMin} ${t("stats.minutesShort")}`} />
        <Tile icon={<Activity className="h-4 w-4" />} label={t("stats.windowTotal")} value={stats.windowTotal.toLocaleString()} caption={`${stats.daysCount} ${t("stats.days")}`} spark={spark} />
      </div>

      {/* Stock (end of line) */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Tile icon={<Warehouse className="h-4 w-4" />} label={t("stats.inStock")} value={stock.inStock.toLocaleString()} />
        <Tile icon={<Package className="h-4 w-4" />} label={t("stats.cartons")} value={stock.cartons.toLocaleString()} />
        <Tile icon={<Layers className="h-4 w-4" />} label={t("stats.pallets")} value={stock.pallets.toLocaleString()} />
        <Tile icon={<PackageCheck className="h-4 w-4" />} label={t("stats.stockedToday")} value={stock.enteredToday.toLocaleString()} caption={t("common.today")} />
      </div>

      {stock.recent.length > 0 && (
        <GlassCard>
          <h3 className="mb-4 font-display text-lg font-semibold text-foreground">{t("stats.recentStock")}</h3>
          <ul className="space-y-2">
            {stock.recent.map((c, i) => (
              <li key={i} className="flex items-center gap-3 rounded-2xl border border-[var(--border)] bg-[var(--surface-2)] px-3 py-2.5">
                <span className="grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-[var(--accent-soft)] text-[var(--accent)]">
                  <Package className="h-4 w-4" />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="truncate font-mono text-sm text-foreground">{c.code ?? "—"}</div>
                  {c.model && <div className="truncate text-xs text-faint">{c.model}</div>}
                </div>
                <Badge tone="success">{c.count}</Badge>
              </li>
            ))}
          </ul>
        </GlassCard>
      )}

      {/* Carton take / return movements */}
      <GlassCard>
        <h3 className="mb-4 font-display text-lg font-semibold text-foreground">{t("stats.cartonMovements")}</h3>
        {movements.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-[var(--border)] py-10 text-center text-sm text-faint">
            {t("movement.empty")}
          </div>
        ) : (
          <ul className="max-h-[24rem] space-y-2 overflow-y-auto">
            {movements.map((m) => (
              <li key={m.id} className="flex items-center gap-3 rounded-2xl border border-[var(--border)] bg-[var(--surface-2)] px-3 py-2.5">
                <span
                  className={cn(
                    "grid h-8 w-8 shrink-0 place-items-center rounded-xl",
                    m.action === "take"
                      ? "bg-amber-500/15 text-amber-600 dark:text-amber-400"
                      : "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400",
                  )}
                >
                  {m.action === "take" ? <LogOut className="h-4 w-4" /> : <LogIn className="h-4 w-4" />}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="truncate font-mono text-sm text-foreground">{m.cartonCode ?? `#${m.cartonNumber ?? "—"}`}</div>
                  <div className="truncate text-xs text-faint">{m.who}</div>
                </div>
                <Badge tone={m.action === "take" ? "warning" : "success"}>
                  {t(m.action === "take" ? "movement.taken" : "movement.returned")}
                </Badge>
                <span className="whitespace-nowrap text-xs text-faint">{new Date(m.at).toLocaleString()}</span>
              </li>
            ))}
          </ul>
        )}
      </GlassCard>

      <GlassCard>
        <h3 className="mb-1 font-display text-lg font-semibold text-foreground">{t("dash.revenueFlow")}</h3>
        <p className="mb-4 text-xs text-faint">{t("stats.scansPerDay")}</p>
        {stats.windowTotal === 0 ? (
          <div className="rounded-2xl border border-dashed border-[var(--border)] py-12 text-center text-sm text-faint">
            {t("stats.noData")}
          </div>
        ) : (
          <AreaChart labels={stats.daily.labels} current={stats.daily.values} />
        )}
      </GlassCard>

      <GlassCard>
        <h3 className="mb-4 font-display text-lg font-semibold text-foreground">{t("stats.recent")}</h3>
        {stats.recent.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-[var(--border)] py-10 text-center text-sm text-faint">
            {t("stats.noData")}
          </div>
        ) : (
          <ul className="space-y-2">
            {stats.recent.map((r, i) => (
              <li key={i} className="flex items-center gap-3 rounded-2xl border border-[var(--border)] bg-[var(--surface-2)] px-3 py-2.5">
                <Avatar initials={initials(r.who)} size="sm" hue={(r.who.charCodeAt(0) * 9) % 360} />
                <div className="min-w-0 flex-1">
                  <div className="truncate font-mono text-sm text-foreground">{r.code}</div>
                  <div className="truncate text-xs text-faint">{r.who}</div>
                </div>
                <Badge tone="accent">{t(`stage.${r.stage}` as DictKey)}</Badge>
                <span className="whitespace-nowrap text-xs text-faint">
                  {new Date(r.at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                </span>
              </li>
            ))}
          </ul>
        )}
      </GlassCard>
    </>
  );
}
