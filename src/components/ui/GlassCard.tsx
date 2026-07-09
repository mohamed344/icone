import { cn } from "@/lib/cn";

interface GlassCardProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Apply density-aware inner padding (var --card-pad). Default true. */
  padded?: boolean;
  /** Add hover-lift micro-interaction. */
  interactive?: boolean;
}

/** The signature frosted-glass surface used across the app. */
export function GlassCard({
  className,
  padded = true,
  interactive = false,
  style,
  children,
  ...rest
}: GlassCardProps) {
  return (
    <div
      className={cn(
        "glass-card",
        interactive && "hover-lift cursor-default",
        className,
      )}
      style={{ padding: padded ? "var(--card-pad)" : undefined, ...style }}
      {...rest}
    >
      {children}
    </div>
  );
}
