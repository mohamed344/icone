"use client";

import { useEffect, useMemo, useState } from "react";
import { useT } from "@/lib/i18n";
import { PageHeader } from "@/components/ui/PageHeader";
import { GlassCard } from "@/components/ui/GlassCard";
import { Badge } from "@/components/ui/Badge";
import { Pagination } from "@/components/ui/Pagination";
import { getCarteDimoLinks, type CarteDimoLink } from "@/app/(app)/admin/links/actions";
import { Search, Link2, Cpu, Loader2 } from "lucide-react";

const PAGE_SIZE = 10;

/** Admin lookup of carte↔dimo links, searchable by either code. */
export function LinksAdmin({ initial }: { initial: CarteDimoLink[] }) {
  const t = useT();
  const [term, setTerm] = useState("");
  const [rows, setRows] = useState<CarteDimoLink[]>(initial);
  const [busy, setBusy] = useState(false);
  const [page, setPage] = useState(1);

  // Reset to the first page whenever a new result set arrives.
  useEffect(() => setPage(1), [rows]);

  const pageCount = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
  const current = Math.min(page, pageCount);
  const start = (current - 1) * PAGE_SIZE;
  const pageRows = useMemo(() => rows.slice(start, start + PAGE_SIZE), [rows, start]);

  async function search(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setRows(await getCarteDimoLinks(term));
    setBusy(false);
  }

  return (
    <>
      <PageHeader title={t("links.title")} subtitle={t("links.subtitle")}>
        <Badge tone="accent" dot>
          {rows.length}
        </Badge>
      </PageHeader>

      <GlassCard className="mb-4">
        <form onSubmit={search} className="flex items-end gap-2">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute start-3 top-3 h-4 w-4 text-faint" />
            <input
              value={term}
              onChange={(e) => setTerm(e.target.value)}
              placeholder={t("links.searchPlaceholder")}
              spellCheck={false}
              className="ring-accent h-10 w-full rounded-2xl border border-[var(--border)] bg-[var(--surface-2)] ps-10 pe-4 font-mono text-sm text-foreground placeholder:text-faint focus:border-[var(--accent)]"
            />
          </div>
          <button
            type="submit"
            disabled={busy}
            className="ring-accent inline-flex h-10 items-center gap-1.5 rounded-2xl bg-accent-gradient px-4 text-sm font-medium text-[var(--accent-contrast)]"
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
            {t("links.search")}
          </button>
        </form>
      </GlassCard>

      <GlassCard padded={false} className="overflow-hidden">
        {rows.length === 0 ? (
          <div className="py-12 text-center text-sm text-faint">{t("links.empty")}</div>
        ) : (
          <ul className="divide-y divide-[var(--border)]">
            {pageRows.map((r) => (
              <li key={r.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-[var(--accent-soft)] text-[var(--accent)]">
                  <Cpu className="h-4 w-4" />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 truncate font-mono text-sm text-foreground">
                    <span className="truncate">{r.carteCode}</span>
                    <Link2 className="h-3.5 w-3.5 shrink-0 text-faint" />
                    <span className="truncate">{r.dimoCode}</span>
                  </div>
                  <div className="text-xs text-faint">
                    {r.by ? `${t("links.by")} ${r.by} · ` : ""}
                    {new Date(r.at).toLocaleString()}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
        {rows.length > 0 && (
          <div className="border-t border-[var(--border)] px-4 py-3">
            <Pagination
              page={current}
              pageCount={pageCount}
              from={start + 1}
              to={Math.min(start + PAGE_SIZE, rows.length)}
              total={rows.length}
              onPage={setPage}
            />
          </div>
        )}
      </GlassCard>
    </>
  );
}
