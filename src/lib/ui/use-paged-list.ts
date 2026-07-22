"use client";

import { useMemo, useState } from "react";

/**
 * Client-side search + pagination over an in-memory list (admin tables load the
 * full set server-side, so filtering/paging happens on the client). `toText`
 * builds the searchable string for each row; the query matches case-insensitively.
 */
export function usePagedList<T>(items: T[], toText: (item: T) => string, pageSize = 10) {
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return items;
    return items.filter((it) => toText(it).toLowerCase().includes(q));
  }, [items, query, toText]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize));
  const current = Math.min(page, pageCount);
  const start = (current - 1) * pageSize;
  const pageItems = filtered.slice(start, start + pageSize);

  return {
    query,
    setQuery: (v: string) => {
      setQuery(v);
      setPage(1); // a new search always returns to the first page
    },
    page: current,
    setPage,
    pageItems,
    pageCount,
    total: filtered.length,
    from: filtered.length === 0 ? 0 : start + 1,
    to: Math.min(start + pageSize, filtered.length),
  };
}
