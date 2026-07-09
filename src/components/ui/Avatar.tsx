import { cn } from "@/lib/cn";

interface AvatarProps {
  initials: string;
  /** Hue 0-360 for a per-person gradient; falls back to the theme accent. */
  hue?: number;
  size?: "sm" | "md" | "lg";
  presence?: "online" | "away" | "offline";
  className?: string;
}

const sizes = {
  sm: "h-8 w-8 text-xs",
  md: "h-10 w-10 text-sm",
  lg: "h-12 w-12 text-base",
};

const presenceColor = {
  online: "bg-emerald-500",
  away: "bg-amber-500",
  offline: "bg-zinc-400",
};

export function Avatar({ initials, hue, size = "md", presence, className }: AvatarProps) {
  const bg = hue != null ? `hsl(${hue} 60% 52%)` : "var(--accent)";
  return (
    <span className={cn("relative inline-grid shrink-0 place-items-center", className)}>
      <span
        className={cn(
          "grid place-items-center rounded-full font-semibold text-white shadow-sm ring-1 ring-white/20",
          sizes[size],
        )}
        style={{ background: bg }}
      >
        {initials}
      </span>
      {presence && (
        <span
          className={cn(
            "absolute -bottom-0 -end-0 h-3 w-3 rounded-full border-2 border-[var(--surface)]",
            presenceColor[presence],
          )}
        />
      )}
    </span>
  );
}
