"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useT } from "@/lib/i18n";
import { PageHeader } from "@/components/ui/PageHeader";
import { GlassCard } from "@/components/ui/GlassCard";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { SearchInput } from "@/components/ui/SearchInput";
import { Pagination } from "@/components/ui/Pagination";
import { usePagedList } from "@/lib/ui/use-paged-list";
import { approveRejectedCarton, type QcCarton } from "@/app/(app)/scan/carton-actions";
import { Package, Check, AlertCircle, Loader2, XCircle } from "lucide-react";

function Row({ carton, onDone }: { carton: QcCarton; onDone: (id: string) => void }) {
  const t = useT();
  const [err, setErr] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function approve() {
    setErr(null);
    start(async () => {
      const res = await approveRejectedCarton(carton.id);
      if (res.error) setErr(res.error);
      else onDone(carton.id);
    });
  }

  return (
    <li className="rounded-2xl border border-[var(--border)] bg-[var(--surface-2)] p-3">
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-rose-500/15 text-rose-600 dark:text-rose-400">
            <Package className="h-4 w-4" />
          </span>
          <div className="min-w-0">
            <div className="truncate font-mono text-sm text-foreground">{carton.code ?? `#${carton.cartonNumber}`}</div>
            <div className="truncate text-xs text-faint">
              {carton.count} · {carton.model ?? "—"}
            </div>
          </div>
        </div>
        <Badge tone="danger" dot>
          {t("qc2.rejected")}
        </Badge>
      </div>
      {carton.qc2Reason && (
        <div className="mt-2 flex items-start gap-2 rounded-xl border border-rose-500/20 bg-rose-500/5 px-3 py-2 text-xs text-muted">
          <XCircle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-rose-500" />
          <span>{carton.qc2Reason}</span>
        </div>
      )}
      <div className="mt-2 flex items-center justify-end gap-2">
        {err && <span className="me-auto text-xs text-rose-500">{err}</span>}
        <Button size="sm" onClick={approve} disabled={pending}>
          {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
          {t("rejected.approve")}
        </Button>
      </div>
    </li>
  );
}

/** Admin (or delegated) re-approval of rejected cartons. */
export function RejectedCartonsAdmin({ initial }: { initial: QcCarton[] }) {
  const t = useT();
  const router = useRouter();
  const [cartons, setCartons] = useState<QcCarton[]>(initial);
  const list = usePagedList(cartons, (c) => `${c.code ?? c.cartonNumber} ${c.model ?? ""} ${c.qc2Reason ?? ""}`);

  function onDone(id: string) {
    setCartons((c) => c.filter((x) => x.id !== id));
    router.refresh();
  }

  return (
    <>
      <PageHeader title={t("rejected.title")} subtitle={t("rejected.subtitle")}>
        <Badge tone="danger" dot>
          {cartons.length}
        </Badge>
      </PageHeader>

      {cartons.length > 0 && (
        <div className="mb-4">
          <SearchInput value={list.query} onChange={list.setQuery} />
        </div>
      )}

      <GlassCard className="flex flex-col gap-3">
        {list.total === 0 ? (
          <div className="flex flex-col items-center gap-2 rounded-2xl border border-dashed border-[var(--border)] py-14 text-center text-sm text-faint">
            <AlertCircle className="h-6 w-6" />
            {cartons.length === 0 ? t("rejected.empty") : t("common.noResults")}
          </div>
        ) : (
          <>
            <ul className="space-y-2">
              {list.pageItems.map((c) => (
                <Row key={c.id} carton={c} onDone={onDone} />
              ))}
            </ul>
            <Pagination
              page={list.page}
              pageCount={list.pageCount}
              from={list.from}
              to={list.to}
              total={list.total}
              onPage={list.setPage}
            />
          </>
        )}
      </GlassCard>
    </>
  );
}
