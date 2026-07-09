"use client";

import Link from "next/link";
import { useT, type DictKey } from "@/lib/i18n";
import { PageHeader } from "@/components/ui/PageHeader";
import { StatCard } from "@/components/ui/StatCard";
import { GlassCard } from "@/components/ui/GlassCard";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Users, ScanLine, ArrowUpRight } from "lucide-react";

export interface RecentScan {
  id: string;
  stage: string;
  code: string;
  entity_type: string;
  scanned_at: string;
}

interface Props {
  employees: number;
  scans: number;
  recent: RecentScan[];
}

export function AdminOverview({ employees, scans, recent }: Props) {
  const t = useT();

  const stats = [
    { label: t("admin.totalEmployees"), value: String(employees), icon: <Users className="h-4 w-4" />, spark: [4, 6, 5, 8, 7, 9, 11, 10, employees || 12] },
    { label: t("admin.totalScans"), value: scans.toLocaleString(), icon: <ScanLine className="h-4 w-4" />, spark: [10, 22, 31, 28, 40, 52, 61, 70, 84] },
  ];

  return (
    <>
      <PageHeader title={t("admin.title")} subtitle={t("admin.subtitle")}>
        <Link href="/admin/employees">
          <Button size="sm">
            <Users className="h-4 w-4" />
            {t("emp.new")}
          </Button>
        </Link>
      </PageHeader>

      <div className="grid gap-4 sm:grid-cols-2">
        {stats.map((s) => (
          <StatCard
            key={s.label}
            label={s.label}
            value={s.value}
            delta="+0%"
            trend="up"
            spark={s.spark}
            icon={s.icon}
          />
        ))}
      </div>

      <GlassCard>
        <div className="mb-4 flex items-center justify-between">
          <h3 className="font-display text-lg font-semibold text-foreground">{t("admin.totalScans")}</h3>
          <span className="text-xs text-faint">{recent.length}</span>
        </div>
        {recent.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-[var(--border)] py-10 text-center text-sm text-faint">
            {t("common.empty")}
          </div>
        ) : (
          <ul className="space-y-2">
            {recent.map((r) => (
              <li
                key={r.id}
                className="flex items-center gap-3 rounded-2xl border border-[var(--border)] bg-[var(--surface-2)] px-3 py-2.5"
              >
                <Badge tone="accent">{t(`stage.${r.stage}` as DictKey)}</Badge>
                <span className="min-w-0 flex-1 truncate font-mono text-sm text-foreground">{r.code}</span>
                <span className="text-xs capitalize text-faint">{r.entity_type}</span>
                <span className="text-xs text-faint">{new Date(r.scanned_at).toLocaleTimeString()}</span>
              </li>
            ))}
          </ul>
        )}
      </GlassCard>
    </>
  );
}
