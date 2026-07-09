import { cn } from "@/lib/cn";

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  icon?: React.ReactNode;
  hint?: string;
}

export function Input({
  label,
  icon,
  hint,
  className,
  id,
  ...rest
}: InputProps) {
  const inputId = id ?? rest.name;
  return (
    <label className="block" htmlFor={inputId}>
      {label && (
        <span className="mb-1.5 block text-sm font-medium text-muted">
          {label}
        </span>
      )}
      <span className="relative block">
        {icon && (
          <span className="pointer-events-none absolute inset-y-0 start-0 grid w-11 place-items-center text-faint">
            {icon}
          </span>
        )}
        <input
          id={inputId}
          className={cn(
            "ring-accent w-full rounded-2xl border border-[var(--border)] bg-[var(--surface-2)]",
            "text-foreground placeholder:text-faint",
            "transition-all duration-200 focus:border-[var(--accent)]",
            icon ? "ps-11 pe-4" : "px-4",
            className,
          )}
          style={{ height: "var(--control-h)" }}
          {...rest}
        />
      </span>
      {hint && <span className="mt-1 block text-xs text-faint">{hint}</span>}
    </label>
  );
}
