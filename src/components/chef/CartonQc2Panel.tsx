"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useT } from "@/lib/i18n";
import { GlassCard } from "@/components/ui/GlassCard";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { overrideCartonQc2, type QcCarton } from "@/app/(app)/scan/carton-actions";
import { Check, X, ShieldCheck } from "lucide-react";

function Row({ carton }: { carton: QcCarton }) {
  const t = useT();
  const router = useRouter();
  const [reason, setReason] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const run = (decision: "approved" | "rejected") =>
    start(async () => {
      setErr(null);
      const res = await overrideCartonQc2(carton.id, decision, reason);
      if (res.error) setErr(res.error);
      else router.refresh();
    });

  const tone = carton.qc2State === "approved" ? "success" : carton.qc2State === "rejected" ? "danger" : "warning";

  return (
    <li className="rounded-2xl border border-[var(--border)] bg-[var(--surface-2)] p-3">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="truncate font-mono text-sm text-foreground">{carton.code ?? `#${carton.cartonNumber}`}</div>
          <div className="truncate text-xs text-faint">
            {carton.count} · {carton.model ?? "—"}
            {carton.qc2Reason ? ` · ${carton.qc2Reason}` : ""}
          </div>
        </div>
        <Badge tone={tone} dot>
          {t(`qc2.${carton.qc2State ?? "pending"}` as never)}
        </Badge>
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <input
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder={t("chef.reason")}
          className="ring-accent h-9 min-w-0 flex-1 rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 text-sm text-foreground placeholder:text-faint focus:border-[var(--accent)]"
        />
        {/* Only offer the decision the carton isn't already in — no re-approving
            an approved carton or re-rejecting a rejected one. */}
        {carton.qc2State !== "approved" && (
          <Button size="sm" variant="glass" disabled={pending} onClick={() => run("approved")}>
            <Check className="h-4 w-4 text-emerald-500" /> {t("qc2.approve")}
          </Button>
        )}
        {carton.qc2State !== "rejected" && (
          <Button size="sm" variant="glass" disabled={pending} onClick={() => run("rejected")}>
            <X className="h-4 w-4 text-rose-500" /> {t("qc2.reject")}
          </Button>
        )}
      </div>
      {err && <p className="mt-1.5 text-xs text-rose-500">{err}</p>}
    </li>
  );
}

/** Chef de ligne control over carton QC#2 decisions (approve/reject/override). */
export function CartonQc2Panel({ cartons }: { cartons: QcCarton[] }) {
  const t = useT();
  return (
    <GlassCard>
      <div className="mb-4 flex items-center gap-2">
        <ShieldCheck className="h-5 w-5 text-[var(--accent)]" />
        <h3 className="font-display text-lg font-semibold text-foreground">{t("chef.cartonsQc2")}</h3>
      </div>
      {cartons.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-[var(--border)] py-10 text-center text-sm text-faint">
          {t("chef.noCartons")}
        </div>
      ) : (
        <ul className="space-y-2">
          {cartons.map((c) => (
            <Row key={c.id} carton={c} />
          ))}
        </ul>
      )}
    </GlassCard>
  );
}
