"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useT } from "@/lib/i18n";
import { PageHeader } from "@/components/ui/PageHeader";
import { GlassCard } from "@/components/ui/GlassCard";
import { Button } from "@/components/ui/Button";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { saveConfig, type ConfigState } from "@/app/(app)/admin/config/actions";
import { Boxes, Hash, Package, AlertCircle, CheckCircle2 } from "lucide-react";

type Mode = "count" | "product";

export function ConfigAdmin({ mode: initMode, size: initSize }: { mode: Mode; size: number }) {
  const t = useT();
  const router = useRouter();
  const [state, formAction, pending] = useActionState<ConfigState, FormData>(saveConfig, {});
  const last = useRef(state);
  const [mode, setMode] = useState<Mode>(initMode);
  const [size, setSize] = useState<number>(initSize);

  useEffect(() => {
    if (state !== last.current) {
      last.current = state;
      if (state.ok) router.refresh();
    }
  }, [state, router]);

  return (
    <>
      <PageHeader title={t("config.title")} subtitle={t("config.subtitle")} />

      {state.error && (
        <div className="flex items-start gap-2 rounded-2xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-600 dark:text-rose-400">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{state.error}</span>
        </div>
      )}
      {state.ok && (
        <div className="flex items-start gap-2 rounded-2xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-600 dark:text-emerald-400">
          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{t("common.saved")}</span>
        </div>
      )}

      <form action={formAction}>
        <GlassCard className="flex max-w-2xl flex-col gap-5">
          <div className="flex items-center gap-3">
            <span className="grid h-10 w-10 place-items-center rounded-xl bg-[var(--accent-soft)] text-[var(--accent)]">
              <Boxes className="h-5 w-5" />
            </span>
            <div>
              <h3 className="font-display text-lg font-semibold text-foreground">{t("config.otpBox")}</h3>
              <p className="text-xs text-faint">{t("config.otpBoxHint")}</p>
            </div>
          </div>

          <input type="hidden" name="otp_box_mode" value={mode} />
          <div>
            <div className="mb-2 text-sm font-medium text-muted">{t("config.mode")}</div>
            <SegmentedControl<Mode>
              value={mode}
              onChange={setMode}
              segments={[
                { value: "count", label: t("config.byCount"), icon: <Hash className="h-4 w-4" /> },
                { value: "product", label: t("config.byProduct"), icon: <Package className="h-4 w-4" /> },
              ]}
            />
          </div>

          {mode === "count" && (
            <label className="block max-w-xs">
              <span className="mb-1.5 block text-sm font-medium text-muted">{t("config.boxSize")}</span>
              <input
                name="otp_box_size"
                type="number"
                min={1}
                max={100000}
                value={size}
                onChange={(e) => setSize(parseInt(e.target.value || "0", 10))}
                className="ring-accent h-11 w-full rounded-2xl border border-[var(--border)] bg-[var(--surface-2)] px-4 text-sm text-foreground focus:border-[var(--accent)]"
              />
              <span className="mt-1 block text-xs text-faint">{t("config.boxSizeHint")}</span>
            </label>
          )}
          {mode === "product" && (
            <>
              <p className="text-sm text-muted">{t("config.productModeNote")}</p>
              {/* keep the last size so switching back to count preserves it */}
              <input type="hidden" name="otp_box_size" value={size} />
            </>
          )}

          <div>
            <Button type="submit" disabled={pending}>
              {t("common.save")}
            </Button>
          </div>
        </GlassCard>
      </form>
    </>
  );
}
