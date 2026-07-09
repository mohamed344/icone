"use client";

import { cn } from "@/lib/cn";

interface ToggleProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label?: string;
  className?: string;
}

export function Toggle({ checked, onChange, label, className }: ToggleProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={cn(
        "ring-accent relative inline-flex h-7 w-12 shrink-0 items-center rounded-full border border-[var(--border)] transition-colors duration-300",
        checked ? "bg-accent-gradient" : "bg-[var(--surface-2)]",
        className,
      )}
    >
      <span
        className={cn(
          "absolute h-5 w-5 rounded-full bg-white shadow-md transition-transform duration-300",
          checked ? "translate-x-6 rtl:-translate-x-6" : "translate-x-1 rtl:-translate-x-1",
        )}
      />
    </button>
  );
}
