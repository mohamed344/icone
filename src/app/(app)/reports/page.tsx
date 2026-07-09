"use client";

import { useT } from "@/lib/i18n";
import { PageHeader } from "@/components/ui/PageHeader";
import { GlassCard } from "@/components/ui/GlassCard";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Select } from "@/components/ui/Select";
import { reports, type ReportItem } from "@/lib/mock-data";
import {
  BarChart3,
  FileText,
  PieChart,
  TrendingUp,
  Sparkles,
  Download,
  Clock,
} from "lucide-react";

const ICON: Record<ReportItem["icon"], React.ReactNode> = {
  bar: <BarChart3 className="h-5 w-5" />,
  doc: <FileText className="h-5 w-5" />,
  pie: <PieChart className="h-5 w-5" />,
  trend: <TrendingUp className="h-5 w-5" />,
};

export default function ReportsPage() {
  const t = useT();
  return (
    <>
      <PageHeader title={t("reports.title")} subtitle={t("reports.subtitle")} />

      <div className="grid gap-4 lg:grid-cols-3">
        {/* Builder */}
        <GlassCard className="flex flex-col gap-4 lg:row-span-2">
          <div className="flex items-center gap-2">
            <span className="grid h-9 w-9 place-items-center rounded-xl bg-accent-gradient text-[var(--accent-contrast)]">
              <Sparkles className="h-4 w-4" />
            </span>
            <h3 className="font-display text-lg font-semibold text-foreground">
              {t("reports.generate")}
            </h3>
          </div>

          <Select
            label={t("reports.range")}
            name="range"
            options={[
              { value: "7d", label: "Last 7 days" },
              { value: "30d", label: "Last 30 days" },
              { value: "q", label: "This quarter" },
              { value: "y", label: "This year" },
            ]}
          />
          <Select
            label={t("common.status")}
            name="type"
            options={[
              { value: "finance", label: "Finance" },
              { value: "ops", label: "Operations" },
              { value: "growth", label: "Growth" },
            ]}
          />

          <div className="space-y-2">
            {["Revenue", "Orders", "Inventory", "Retention"].map((m) => (
              <label
                key={m}
                className="flex cursor-pointer items-center gap-2.5 rounded-xl border border-[var(--border)] bg-[var(--surface-2)] px-3 py-2.5 text-sm text-foreground"
              >
                <input type="checkbox" defaultChecked className="peer sr-only" />
                <span className="grid h-4 w-4 place-items-center rounded-[5px] border border-[var(--border)] peer-checked:bg-accent-gradient peer-checked:border-transparent" />
                {m}
              </label>
            ))}
          </div>

          <Button className="mt-auto w-full">
            <Download className="h-4 w-4" />
            {t("reports.generate")}
          </Button>
        </GlassCard>

        {/* Library */}
        <GlassCard className="lg:col-span-2">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="font-display text-lg font-semibold text-foreground">
              {t("reports.library")}
            </h3>
            <Button variant="ghost" size="sm">
              {t("common.viewAll")}
            </Button>
          </div>
          <ul className="space-y-2">
            {reports.map((r) => (
              <li
                key={r.name}
                className="group flex items-center gap-3 rounded-2xl border border-[var(--border)] bg-[var(--surface-2)] p-3 transition-all hover:border-[var(--accent)] hover:shadow-sm"
              >
                <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-[var(--accent-soft)] text-[var(--accent)]">
                  {ICON[r.icon]}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="truncate font-medium text-foreground">{r.name}</div>
                  <div className="flex items-center gap-2 text-xs text-faint">
                    <span>{r.type}</span>·<span>{t("common.today")} {r.updated}</span>
                  </div>
                </div>
                <Badge tone="info">
                  <Clock className="h-3 w-3" />
                  {r.schedule}
                </Badge>
                <Button variant="glass" size="icon">
                  <Download className="h-4 w-4" />
                </Button>
              </li>
            ))}
          </ul>
        </GlassCard>

        {/* Scheduled summary */}
        <GlassCard className="lg:col-span-2">
          <h3 className="mb-3 font-display text-lg font-semibold text-foreground">
            {t("reports.scheduled")}
          </h3>
          <div className="grid gap-3 sm:grid-cols-3">
            {[
              { k: "Weekly", v: "2" },
              { k: "Monthly", v: "3" },
              { k: "Quarterly", v: "1" },
            ].map((s) => (
              <div key={s.k} className="rounded-2xl bg-[var(--surface-2)] p-4 text-center">
                <div className="font-display text-2xl font-semibold text-foreground">{s.v}</div>
                <div className="text-xs text-faint">{s.k}</div>
              </div>
            ))}
          </div>
        </GlassCard>
      </div>
    </>
  );
}
