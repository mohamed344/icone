"use client";

import { cn } from "@/lib/cn";
import { Check } from "lucide-react";

interface ColorSwatchProps {
  /** Solid fill color (no gradients). */
  color: string;
  name: string;
  selected: boolean;
  onClick: () => void;
}

/** Returns true for light fills so the check mark switches to dark. */
function isLight(hex: string): boolean {
  const m = hex.replace("#", "");
  if (m.length < 6) return false;
  const r = parseInt(m.slice(0, 2), 16);
  const g = parseInt(m.slice(2, 4), 16);
  const b = parseInt(m.slice(4, 6), 16);
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255 > 0.6;
}

export function ColorSwatch({ color, name, selected, onClick }: ColorSwatchProps) {
  const light = isLight(color);
  return (
    <button
      type="button"
      onClick={onClick}
      title={name}
      aria-pressed={selected}
      className={cn(
        "ring-accent group relative grid h-12 w-12 place-items-center rounded-2xl border border-[var(--border)] transition-transform duration-200 hover:scale-105",
        selected && "scale-105",
      )}
      style={{ background: color }}
    >
      <span
        className={cn(
          "absolute inset-0 rounded-2xl ring-2 ring-offset-2 transition-opacity",
          "ring-[var(--accent)] ring-offset-[var(--surface)]",
          selected ? "opacity-100" : "opacity-0",
        )}
      />
      <Check
        className={cn(
          "h-5 w-5 transition-all",
          light ? "text-[var(--foreground)]" : "text-white drop-shadow",
          selected ? "scale-100 opacity-100" : "scale-50 opacity-0",
        )}
        strokeWidth={3}
      />
    </button>
  );
}
