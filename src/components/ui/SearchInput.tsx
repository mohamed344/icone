"use client";

import { useT } from "@/lib/i18n";
import { Search, X } from "lucide-react";

/** Compact search box with an icon and a clear button. */
export function SearchInput({
  value,
  onChange,
  placeholder,
  className,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  className?: string;
}) {
  const t = useT();
  return (
    <div className={`relative w-full sm:max-w-xs ${className ?? ""}`}>
      <Search className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-faint" />
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder ?? t("common.searchList")}
        spellCheck={false}
        className="ring-accent h-10 w-full rounded-2xl border border-[var(--border)] bg-[var(--surface-2)] ps-10 pe-9 text-sm text-foreground placeholder:text-faint focus:border-[var(--accent)]"
      />
      {value && (
        <button
          type="button"
          onClick={() => onChange("")}
          aria-label={t("common.clear")}
          className="ring-accent absolute end-2 top-1/2 grid h-6 w-6 -translate-y-1/2 place-items-center rounded-lg text-faint hover:text-foreground"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  );
}
