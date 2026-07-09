import { cn } from "@/lib/cn";

type Variant = "primary" | "glass" | "ghost" | "outline";
type Size = "sm" | "md" | "lg" | "icon";

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
}

const sizes: Record<Size, string> = {
  sm: "h-9 px-3.5 text-sm rounded-xl gap-1.5",
  md: "h-11 px-5 text-sm rounded-2xl gap-2",
  lg: "h-12 px-6 text-base rounded-2xl gap-2",
  icon: "h-10 w-10 rounded-xl justify-center",
};

const variants: Record<Variant, string> = {
  primary:
    "bg-accent-gradient text-[var(--accent-contrast)] glow hover:brightness-[1.06] active:brightness-95 border border-white/10",
  glass:
    "glass-2 text-foreground hover:bg-[var(--surface-2)] border border-[var(--glass-border)]",
  ghost: "text-muted hover:text-foreground hover:bg-[var(--accent-soft)]",
  outline:
    "border border-[var(--border)] text-foreground hover:border-[var(--accent)] hover:text-[var(--accent)]",
};

export function Button({
  variant = "primary",
  size = "md",
  className,
  children,
  ...rest
}: ButtonProps) {
  return (
    <button
      className={cn(
        "ring-accent inline-flex items-center justify-center font-medium",
        "transition-all duration-200 active:scale-[0.98] disabled:opacity-50 disabled:pointer-events-none",
        "select-none whitespace-nowrap",
        sizes[size],
        variants[variant],
        className,
      )}
      {...rest}
    >
      {children}
    </button>
  );
}
