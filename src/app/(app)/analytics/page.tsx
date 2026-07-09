"use client";

import { useT } from "@/lib/i18n";
import { PageHeader } from "@/components/ui/PageHeader";
import { StatCard } from "@/components/ui/StatCard";
import { GlassCard } from "@/components/ui/GlassCard";
import { Button } from "@/components/ui/Button";
import { AreaChart } from "@/components/charts/AreaChart";
import { DonutChart } from "@/components/charts/DonutChart";
import {
  analyticsStats,
  revenueSeries,
  trafficSources,
  channelBreakdown,
  weeklyCohorts,
} from "@/lib/mock-data";
import { Users, Percent, Receipt, Repeat, Download } from "lucide-react";

const ICONS: Record<string, React.ReactNode> = {
  visitors: <Users className="h-4 w-4" />,
  conversion: <Percent className="h-4 w-4" />,
  avgOrder: <Receipt className="h-4 w-4" />,
  retention: <Repeat className="h-4 w-4" />,
};

function cohortColor(v: number) {
  if (v === 0) return "transparent";
  return `color-mix(in oklab, var(--accent) ${Math.round(v)}%, transparent)`;
}

export default function AnalyticsPage() {
  const t = useT();

  return (
    <>
      <PageHeader title={t("analytics.title")} subtitle={t("analytics.subtitle")}>
        <Button variant="glass" size="sm">
          <Download className="h-4 w-4" />
          {t("common.export")}
        </Button>
      </PageHeader>

      <div className="stagger grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {analyticsStats.map((s, i) => (
          <StatCard
            key={s.key}
            style={{ ["--i" as string]: i }}
            label={t(s.labelKey)}
            value={s.value}
            delta={s.delta}
            trend={s.trend}
            spark={s.spark}
            caption={t("common.vsLast")}
            icon={ICONS[s.key]}
          />
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <GlassCard className="lg:col-span-2">
          <h3 className="mb-1 font-display text-lg font-semibold text-foreground">
            {t("analytics.traffic")}
          </h3>
          <p className="mb-4 text-xs text-faint">{t("common.thisMonth")}</p>
          <AreaChart labels={revenueSeries.labels} current={revenueSeries.current} previous={revenueSeries.previous} />
        </GlassCard>

        <GlassCard>
          <h3 className="mb-4 font-display text-lg font-semibold text-foreground">
            {t("analytics.sources")}
          </h3>
          <ul className="space-y-4">
            {trafficSources.map((s) => (
              <li key={s.label}>
                <div className="mb-1.5 flex items-center justify-between text-sm">
                  <span className="text-muted">{s.label}</span>
                  <span className="font-medium text-foreground">{s.count}</span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-[var(--surface-2)]">
                  <div
                    className="h-full rounded-full bg-accent-gradient transition-all"
                    style={{ width: `${s.value * 2.5}%` }}
                  />
                </div>
              </li>
            ))}
          </ul>
        </GlassCard>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <GlassCard className="flex flex-col items-center">
          <h3 className="mb-4 self-start font-display text-lg font-semibold text-foreground">
            {t("analytics.breakdown")}
          </h3>
          <DonutChart data={channelBreakdown} centerValue="100%" centerLabel={t("common.all")} />
          <ul className="mt-5 grid w-full grid-cols-2 gap-2">
            {channelBreakdown.map((c) => (
              <li key={c.label} className="flex items-center gap-2 text-xs text-muted">
                <span className="h-2.5 w-2.5 rounded-full" style={{ background: c.color }} />
                {c.label}
              </li>
            ))}
          </ul>
        </GlassCard>

        {/* Cohort heatmap */}
        <GlassCard className="lg:col-span-2">
          <h3 className="mb-4 font-display text-lg font-semibold text-foreground">
            {t("analytics.cohorts")}
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full border-separate" style={{ borderSpacing: "4px" }}>
              <thead>
                <tr>
                  <th className="w-16" />
                  {["W0", "W1", "W2", "W3", "W4", "W5"].map((w) => (
                    <th key={w} className="pb-1 text-center text-xs font-medium text-faint">
                      {w}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {weeklyCohorts.map((row, ri) => (
                  <tr key={ri}>
                    <td className="pe-2 text-end text-xs text-faint">Jun {ri * 5 + 1}</td>
                    {row.map((v, ci) => (
                      <td key={ci}>
                        <div
                          className="grid h-10 place-items-center rounded-lg text-xs font-medium transition-colors"
                          style={{
                            background: cohortColor(v),
                            color: v > 50 ? "var(--accent-contrast)" : "var(--muted)",
                            border: v === 0 ? "1px dashed var(--border)" : "none",
                          }}
                        >
                          {v > 0 ? `${v}%` : ""}
                        </div>
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </GlassCard>
      </div>
    </>
  );
}
