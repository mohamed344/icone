"use client";

import Link from "next/link";
import { useT, type DictKey } from "@/lib/i18n";
import { PageHeader } from "@/components/ui/PageHeader";
import { GlassCard } from "@/components/ui/GlassCard";
import { cn } from "@/lib/cn";
import { Factory } from "lucide-react";
import type { WorkflowStage } from "@/lib/workflow";

/** Page title + a chip per station; picking one navigates to /chef?station=<stage>. */
export function StationSwitcher({
  stages,
  active,
}: {
  stages: WorkflowStage[];
  active: WorkflowStage;
}) {
  const t = useT();
  return (
    <>
      <PageHeader title={t("chef.title")} subtitle={t("chef.subtitle")} />
      <GlassCard className="flex flex-col gap-3">
        <span className="flex items-center gap-1.5 text-sm font-medium text-muted">
          <Factory className="h-4 w-4" /> {t("chef.station")}
        </span>
        <div className="flex flex-wrap gap-2">
          {stages.map((s) => {
            const isActive = s === active;
            return (
              <Link
                key={s}
                href={`/chef?station=${s}`}
                scroll={false}
                className={cn(
                  "ring-accent rounded-xl border px-3 py-1.5 text-xs font-medium transition-colors",
                  isActive
                    ? "border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--accent)]"
                    : "border-[var(--border)] bg-[var(--surface-2)] text-muted hover:border-[var(--accent)] hover:text-[var(--accent)]",
                )}
              >
                {t(`stage.${s}` as DictKey)}
              </Link>
            );
          })}
        </div>
      </GlassCard>
    </>
  );
}
