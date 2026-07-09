"use client";

import { cn } from "@/lib/cn";

export interface Segment<T extends string> {
  value: T;
  label: string;
  icon?: React.ReactNode;
}

interface SegmentedControlProps<T extends string> {
  value: T;
  onChange: (value: T) => void;
  segments: Segment<T>[];
  size?: "sm" | "md";
  className?: string;
}

export function SegmentedControl<T extends string>({
  value,
  onChange,
  segments,
  size = "md",
  className,
}: SegmentedControlProps<T>) {
  return (
    <div
      role="tablist"
      className={cn(
        "inline-flex rounded-2xl border border-[var(--border)] bg-[var(--surface-2)] p-1",
        className,
      )}
    >
      {segments.map((seg) => {
        const active = seg.value === value;
        return (
          <button
            key={seg.value}
            role="tab"
            aria-selected={active}
            onClick={() => onChange(seg.value)}
            className={cn(
              "ring-accent inline-flex items-center justify-center gap-1.5 rounded-xl font-medium transition-all duration-200",
              size === "sm" ? "h-8 px-3 text-xs" : "h-10 px-4 text-sm",
              active
                ? "bg-accent-gradient text-[var(--accent-contrast)] shadow-sm"
                : "text-muted hover:text-foreground",
            )}
          >
            {seg.icon}
            {seg.label}
          </button>
        );
      })}
    </div>
  );
}
