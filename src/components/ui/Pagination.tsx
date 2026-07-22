"use client";

import { useT } from "@/lib/i18n";
import { ChevronLeft, ChevronRight } from "lucide-react";

/** "X–Y of N" summary + prev/next controls. Renders nothing for an empty list. */
export function Pagination({
  page,
  pageCount,
  from,
  to,
  total,
  onPage,
}: {
  page: number;
  pageCount: number;
  from: number;
  to: number;
  total: number;
  onPage: (p: number) => void;
}) {
  const t = useT();
  if (total === 0) return null;

  const btn =
    "ring-accent grid h-8 w-8 place-items-center rounded-lg border border-[var(--border)] text-muted transition-colors hover:border-[var(--accent)] hover:text-[var(--accent)] disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:border-[var(--border)] disabled:hover:text-muted";

  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <span className="text-xs text-faint">
        {t("pager.showing")
          .replace("{from}", String(from))
          .replace("{to}", String(to))
          .replace("{total}", String(total))}
      </span>
      {pageCount > 1 && (
        <div className="flex items-center gap-1.5">
          <button type="button" onClick={() => onPage(page - 1)} disabled={page <= 1} className={btn} aria-label="Previous">
            <ChevronLeft className="h-4 w-4 flip-rtl" />
          </button>
          <span className="px-1 text-xs font-medium text-muted">
            {page} / {pageCount}
          </span>
          <button type="button" onClick={() => onPage(page + 1)} disabled={page >= pageCount} className={btn} aria-label="Next">
            <ChevronRight className="h-4 w-4 flip-rtl" />
          </button>
        </div>
      )}
    </div>
  );
}
