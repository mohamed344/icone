"use client";

import { useActionState, useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useT } from "@/lib/i18n";
import { PageHeader } from "@/components/ui/PageHeader";
import { GlassCard } from "@/components/ui/GlassCard";
import { Button } from "@/components/ui/Button";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { saveConfig, addModel, deleteModel, type ConfigState } from "@/app/(app)/admin/config/actions";
import type { ModelRef } from "@/app/(app)/scan/carton-actions";
import { Boxes, Hash, Package, AlertCircle, CheckCircle2, Tag, Plus, Trash2 } from "lucide-react";

type Mode = "count" | "product";

export function ConfigAdmin({
  mode: initMode,
  size: initSize,
  cartonSize: initCarton,
  palletSize: initPallet,
  models,
}: {
  mode: Mode;
  size: number;
  cartonSize: number;
  palletSize: number;
  models: ModelRef[];
}) {
  const t = useT();
  const router = useRouter();
  const [state, formAction, pending] = useActionState<ConfigState, FormData>(saveConfig, {});
  const last = useRef(state);
  const [mode, setMode] = useState<Mode>(initMode);
  const [size, setSize] = useState<number>(initSize);
  const [cartonSize, setCartonSize] = useState<number>(initCarton);
  const [palletSize, setPalletSize] = useState<number>(initPallet);

  // Product models manager
  const [ref, setRef] = useState("");
  const [name, setName] = useState("");
  const [modelErr, setModelErr] = useState<string | null>(null);
  const [modelPending, startModel] = useTransition();

  function submitModel() {
    setModelErr(null);
    startModel(async () => {
      const res = await addModel(ref, name);
      if (res.error) setModelErr(res.error);
      else {
        setRef("");
        setName("");
        router.refresh();
      }
    });
  }
  function removeModel(id: string) {
    startModel(async () => {
      await deleteModel(id);
      router.refresh();
    });
  }

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

          <div className="border-t border-[var(--border)] pt-5">
            <div className="mb-4 flex items-center gap-3">
              <span className="grid h-10 w-10 place-items-center rounded-xl bg-[var(--accent-soft)] text-[var(--accent)]">
                <Package className="h-5 w-5" />
              </span>
              <div>
                <h3 className="font-display text-lg font-semibold text-foreground">{t("config.cartonPallet")}</h3>
                <p className="text-xs text-faint">{t("config.cartonPalletHint")}</p>
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block">
                <span className="mb-1.5 block text-sm font-medium text-muted">{t("config.cartonSize")}</span>
                <input
                  name="carton_size"
                  type="number"
                  min={1}
                  max={100000}
                  value={cartonSize}
                  onChange={(e) => setCartonSize(parseInt(e.target.value || "0", 10))}
                  className="ring-accent h-11 w-full rounded-2xl border border-[var(--border)] bg-[var(--surface-2)] px-4 text-sm text-foreground focus:border-[var(--accent)]"
                />
                <span className="mt-1 block text-xs text-faint">{t("config.cartonSizeHint")}</span>
              </label>
              <label className="block">
                <span className="mb-1.5 block text-sm font-medium text-muted">{t("config.palletSize")}</span>
                <input
                  name="pallet_size"
                  type="number"
                  min={1}
                  max={100000}
                  value={palletSize}
                  onChange={(e) => setPalletSize(parseInt(e.target.value || "0", 10))}
                  className="ring-accent h-11 w-full rounded-2xl border border-[var(--border)] bg-[var(--surface-2)] px-4 text-sm text-foreground focus:border-[var(--accent)]"
                />
                <span className="mt-1 block text-xs text-faint">{t("config.palletSizeHint")}</span>
              </label>
            </div>
          </div>

          <div>
            <Button type="submit" disabled={pending}>
              {t("common.save")}
            </Button>
          </div>
        </GlassCard>
      </form>

      {/* Product models — the Scan PF operator picks one of these per carton */}
      <GlassCard className="flex max-w-2xl flex-col gap-4">
        <div className="flex items-center gap-3">
          <span className="grid h-10 w-10 place-items-center rounded-xl bg-[var(--accent-soft)] text-[var(--accent)]">
            <Tag className="h-5 w-5" />
          </span>
          <div>
            <h3 className="font-display text-lg font-semibold text-foreground">{t("config.models")}</h3>
            <p className="text-xs text-faint">{t("config.modelsHint")}</p>
          </div>
        </div>

        {models.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-[var(--border)] py-6 text-center text-sm text-faint">
            {t("config.noModels")}
          </div>
        ) : (
          <ul className="flex flex-wrap gap-2">
            {models.map((m) => (
              <li
                key={m.id}
                className="flex items-center gap-2 rounded-xl border border-[var(--border)] bg-[var(--surface-2)] py-1.5 ps-3 pe-1.5 text-sm"
              >
                <span className="font-medium text-foreground">{m.name}</span>
                <button
                  onClick={() => removeModel(m.id)}
                  disabled={modelPending}
                  className="ring-accent grid h-6 w-6 place-items-center rounded-lg text-faint hover:bg-rose-500/10 hover:text-rose-500"
                  aria-label={t("common.delete")}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </li>
            ))}
          </ul>
        )}

        <div className="flex flex-wrap items-end gap-2">
          <label className="min-w-[8rem] flex-1">
            <span className="mb-1.5 block text-xs font-medium text-muted">{t("config.modelName")}</span>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="ICONE D40"
              className="ring-accent h-10 w-full rounded-xl border border-[var(--border)] bg-[var(--surface-2)] px-3 text-sm text-foreground placeholder:text-faint focus:border-[var(--accent)]"
            />
          </label>
          <label className="min-w-[8rem] flex-1">
            <span className="mb-1.5 block text-xs font-medium text-muted">{t("config.modelRef")}</span>
            <input
              value={ref}
              onChange={(e) => setRef(e.target.value)}
              placeholder="D40"
              className="ring-accent h-10 w-full rounded-xl border border-[var(--border)] bg-[var(--surface-2)] px-3 text-sm text-foreground placeholder:text-faint focus:border-[var(--accent)]"
            />
          </label>
          <Button variant="glass" onClick={submitModel} disabled={modelPending || !ref.trim()}>
            <Plus className="h-4 w-4" /> {t("config.addModel")}
          </Button>
        </div>
        {modelErr && <p className="text-xs text-rose-500">{modelErr}</p>}
      </GlassCard>
    </>
  );
}
