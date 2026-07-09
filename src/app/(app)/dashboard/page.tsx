"use client";

import { useT } from "@/lib/i18n";
import { PageHeader } from "@/components/ui/PageHeader";
import { StatCard } from "@/components/ui/StatCard";
import { GlassCard } from "@/components/ui/GlassCard";
import { Button } from "@/components/ui/Button";
import { Avatar } from "@/components/ui/Avatar";
import { Badge } from "@/components/ui/Badge";
import { AreaChart } from "@/components/charts/AreaChart";
import { DonutChart } from "@/components/charts/DonutChart";
import {
  dashboardStats,
  revenueSeries,
  channelBreakdown,
  recentActivity,
} from "@/lib/mock-data";
import {
  DollarSign,
  ShoppingBag,
  Users,
  PackageCheck,
  Plus,
  Download,
  ArrowUpRight,
} from "lucide-react";

const STAT_ICONS: Record<string, React.ReactNode> = {
  revenue: <DollarSign className="h-4 w-4" />,
  orders: <ShoppingBag className="h-4 w-4" />,
  clients: <Users className="h-4 w-4" />,
  fulfilment: <PackageCheck className="h-4 w-4" />,
};

export default function DashboardPage() {
  const t = useT();

  return (
    <>
      <PageHeader title={`${t("common.greeting")}, Nadia`} subtitle={t("dash.subtitle")}>
        <Button variant="glass" size="sm">
          <Download className="h-4 w-4" />
          {t("common.export")}
        </Button>
        <Button size="sm">
          <Plus className="h-4 w-4" />
          {t("common.new")}
        </Button>
      </PageHeader>

      {/* Stats */}
      <div className="stagger grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {dashboardStats.map((s, i) => (
          <StatCard
            key={s.key}
            style={{ ["--i" as string]: i }}
            label={t(s.labelKey)}
            value={s.value}
            delta={s.delta}
            trend={s.trend}
            spark={s.spark}
            caption={t("common.vsLast")}
            icon={STAT_ICONS[s.key]}
          />
        ))}
      </div>

      {/* Charts row */}
      <div className="grid gap-4 lg:grid-cols-3">
        <GlassCard className="lg:col-span-2">
          <div className="mb-5 flex items-center justify-between">
            <div>
              <h3 className="font-display text-lg font-semibold text-foreground">
                {t("dash.revenueFlow")}
              </h3>
              <p className="text-xs text-faint">{t("common.thisMonth")} · USD</p>
            </div>
            <div className="flex items-center gap-4 text-xs">
              <span className="flex items-center gap-1.5 text-muted">
                <span className="h-2 w-4 rounded-full bg-accent-gradient" /> 2024
              </span>
              <span className="flex items-center gap-1.5 text-faint">
                <span className="h-2 w-4 rounded-full bg-[var(--muted)]/40" /> 2023
              </span>
            </div>
          </div>
          <AreaChart
            labels={revenueSeries.labels}
            current={revenueSeries.current}
            previous={revenueSeries.previous}
          />
        </GlassCard>

        <GlassCard className="flex flex-col">
          <h3 className="mb-1 font-display text-lg font-semibold text-foreground">
            {t("dash.byChannel")}
          </h3>
          <p className="mb-4 text-xs text-faint">{t("common.thisMonth")}</p>
          <div className="flex flex-1 flex-col items-center justify-center gap-5">
            <DonutChart data={channelBreakdown} centerValue="$48.2k" centerLabel={t("dash.revenue")} />
            <ul className="w-full space-y-2">
              {channelBreakdown.map((c) => (
                <li key={c.label} className="flex items-center justify-between text-sm">
                  <span className="flex items-center gap-2 text-muted">
                    <span className="h-2.5 w-2.5 rounded-full" style={{ background: c.color }} />
                    {c.label}
                  </span>
                  <span className="font-medium text-foreground">{c.value}%</span>
                </li>
              ))}
            </ul>
          </div>
        </GlassCard>
      </div>

      {/* Activity */}
      <div className="grid gap-4 lg:grid-cols-3">
        <GlassCard className="lg:col-span-2">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="font-display text-lg font-semibold text-foreground">
              {t("dash.recentActivity")}
            </h3>
            <Button variant="ghost" size="sm">
              {t("common.viewAll")}
            </Button>
          </div>
          <ul className="-mx-2">
            {recentActivity.map((a, i) => (
              <li
                key={i}
                className="flex items-center gap-3 rounded-2xl px-2 py-3 transition-colors hover:bg-[var(--surface-2)]"
              >
                <Avatar initials={a.initials} hue={a.hue} size="sm" />
                <p className="flex-1 text-sm text-muted">
                  <span className="font-medium text-foreground">{a.who}</span> {a.action}{" "}
                  <span className="font-medium text-[var(--accent)]">{a.target}</span>
                </p>
                <span className="text-xs text-faint">{a.time}</span>
              </li>
            ))}
          </ul>
        </GlassCard>

        <GlassCard className="flex flex-col gap-3">
          <h3 className="font-display text-lg font-semibold text-foreground">
            {t("dash.quickActions")}
          </h3>
          {[
            { label: t("dash.orders"), tone: "accent" as const },
            { label: t("dash.clients"), tone: "info" as const },
            { label: t("nav.reports"), tone: "success" as const },
          ].map((q) => (
            <button
              key={q.label}
              className="group flex items-center justify-between rounded-2xl border border-[var(--border)] bg-[var(--surface-2)] px-4 py-3 text-start text-sm font-medium text-foreground transition-all hover:border-[var(--accent)] hover:shadow-sm"
            >
              <span className="flex items-center gap-2">
                <Badge tone={q.tone} dot>
                  {t("common.new")}
                </Badge>
                {q.label}
              </span>
              <ArrowUpRight className="h-4 w-4 text-faint transition-colors group-hover:text-[var(--accent)] flip-rtl" />
            </button>
          ))}
        </GlassCard>
      </div>
    </>
  );
}
