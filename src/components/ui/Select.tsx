import { cn } from "@/lib/cn";

interface Option {
  value: string;
  label: string;
}

interface SelectProps
  extends Omit<React.SelectHTMLAttributes<HTMLSelectElement>, "children"> {
  options: Option[];
  label?: string;
}

export function Select({ options, label, className, id, ...rest }: SelectProps) {
  const selectId = id ?? rest.name;
  return (
    <label className="block" htmlFor={selectId}>
      {label && (
        <span className="mb-1.5 block text-sm font-medium text-muted">{label}</span>
      )}
      <div className="relative">
        <select
          id={selectId}
          className={cn(
            "ring-accent w-full appearance-none rounded-2xl border border-[var(--border)] bg-[var(--surface-2)]",
            "px-4 pe-10 text-sm text-foreground transition-all duration-200 focus:border-[var(--accent)]",
            className,
          )}
          style={{ height: "var(--control-h)" }}
          {...rest}
        >
          {options.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
        <svg
          className="pointer-events-none absolute inset-y-0 end-3 my-auto h-4 w-4 text-faint"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        >
          <path d="m6 9 6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </div>
    </label>
  );
}
