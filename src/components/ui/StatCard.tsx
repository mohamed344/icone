import { cn } from "@/lib/cn";
import { GlassCard } from "./GlassCard";
import { Sparkline } from "@/components/charts/Sparkline";
import { ArrowUpRight, ArrowDownRight } from "lucide-react";

interface StatCardProps {
  label: string;
  value: string;
  delta: string;
  trend: "up" | "down";
  spark: number[];
  caption?: string;
  icon?: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
}

export function StatCard({
  label,
  value,
  delta,
  trend,
  spark,
  caption,
  icon,
  className,
  style,
}: StatCardProps) {
  const up = trend === "up";
  return (
    <GlassCard interactive className={cn("flex flex-col gap-4", className)} style={style}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2.5">
          {icon && (
            <span className="grid h-9 w-9 place-items-center rounded-xl bg-[var(--accent-soft)] text-[var(--accent)]">
              {icon}
            </span>
          )}
          <span className="text-sm font-medium text-muted">{label}</span>
        </div>
        <span
          className={cn(
            "inline-flex items-center gap-0.5 rounded-full px-2 py-0.5 text-xs font-semibold",
            up
              ? "bg-emerald-500/12 text-emerald-600 dark:text-emerald-400"
              : "bg-rose-500/12 text-rose-600 dark:text-rose-400",
          )}
        >
          {up ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
          {delta}
        </span>
      </div>
      <div className="flex items-end justify-between gap-3">
        <div>
          <div className="font-display text-3xl font-semibold tracking-tight text-foreground">
            {value}
          </div>
          {caption && <div className="mt-0.5 text-xs text-faint">{caption}</div>}
        </div>
        <Sparkline data={spark} trend={trend} className="opacity-90" />
      </div>
    </GlassCard>
  );
}
