import { cn } from "@/lib/cn";

export type Tone = "accent" | "success" | "warning" | "danger" | "neutral" | "info";

const tones: Record<Tone, string> = {
  accent: "text-[var(--accent)] bg-[var(--accent-soft)]",
  success: "text-emerald-600 dark:text-emerald-400 bg-emerald-500/12",
  warning: "text-amber-600 dark:text-amber-400 bg-amber-500/12",
  danger: "text-rose-600 dark:text-rose-400 bg-rose-500/12",
  info: "text-sky-600 dark:text-sky-400 bg-sky-500/12",
  neutral: "text-muted bg-[var(--surface-2)]",
};

interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  tone?: Tone;
  dot?: boolean;
}

export function Badge({ tone = "neutral", dot, className, children, ...rest }: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium",
        tones[tone],
        className,
      )}
      {...rest}
    >
      {dot && <span className="h-1.5 w-1.5 rounded-full bg-current" />}
      {children}
    </span>
  );
}
