"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useT } from "@/lib/i18n";
import { PageHeader } from "@/components/ui/PageHeader";
import { GlassCard } from "@/components/ui/GlassCard";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Scanner } from "@/components/scan/Scanner";
import { overrideQc } from "@/app/(app)/chef/actions";
import type { WorkflowStage } from "@/lib/workflow";
import { Check, X, ShieldCheck } from "lucide-react";

export interface QcRow {
  id: string;
  item_id: string | null;
  decision: string;
  reason: string | null;
  overridden_by: string | null;
  decided_at: string;
}

function OverrideRow({ row }: { row: QcRow }) {
  const t = useT();
  const router = useRouter();
  const [reason, setReason] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const run = (decision: "approved" | "rejected") =>
    start(async () => {
      setErr(null);
      const res = await overrideQc(row.id, decision, reason);
      if (res.error) setErr(res.error);
      else router.refresh();
    });

  const tone =
    row.decision === "approved" ? "success" : row.decision === "rejected" ? "danger" : "warning";

  return (
    <li className="rounded-2xl border border-[var(--border)] bg-[var(--surface-2)] p-3">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="truncate font-mono text-sm text-foreground">
            {row.item_id ?? row.id}
          </div>
          <div className="text-xs text-faint">{new Date(row.decided_at).toLocaleString()}</div>
        </div>
        <Badge tone={tone} dot>
          {row.decision}
        </Badge>
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <input
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder={t("chef.reason")}
          className="ring-accent h-9 min-w-0 flex-1 rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 text-sm text-foreground placeholder:text-faint focus:border-[var(--accent)]"
        />
        <Button size="sm" variant="glass" disabled={pending} onClick={() => run("approved")}>
          <Check className="h-4 w-4 text-emerald-500" /> {t("chef.approve")}
        </Button>
        <Button size="sm" variant="glass" disabled={pending} onClick={() => run("rejected")}>
          <X className="h-4 w-4 text-rose-500" /> {t("chef.reject")}
        </Button>
      </div>
      {err && <p className="mt-1.5 text-xs text-rose-500">{err}</p>}
    </li>
  );
}

export function ChefView({ rows, stages }: { rows: QcRow[]; stages: WorkflowStage[] }) {
  const t = useT();
  return (
    <>
      <PageHeader title={t("chef.title")} subtitle={t("chef.subtitle")} />

      <Scanner stages={stages} />

      <GlassCard>
        <div className="mb-4 flex items-center gap-2">
          <ShieldCheck className="h-5 w-5 text-[var(--accent)]" />
          <h3 className="font-display text-lg font-semibold text-foreground">{t("chef.override")}</h3>
        </div>
        {rows.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-[var(--border)] py-10 text-center text-sm text-faint">
            {t("chef.noPending")}
          </div>
        ) : (
          <ul className="space-y-2">
            {rows.map((r) => (
              <OverrideRow key={r.id} row={r} />
            ))}
          </ul>
        )}
      </GlassCard>
    </>
  );
}
