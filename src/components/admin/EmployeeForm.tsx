"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useT, type DictKey } from "@/lib/i18n";
import { cn } from "@/lib/cn";
import { GlassCard } from "@/components/ui/GlassCard";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { saveEmployee, type EmployeeState } from "@/app/(app)/admin/employees/actions";
import { ROLES, WORKFLOW_STAGES, USER_STATUSES, type Role, type WorkflowStage } from "@/lib/workflow";
import { UserPlus, Pencil, AlertCircle, ArrowLeft, Check, Plus } from "lucide-react";

export interface EmployeeInitial {
  id: string;
  full_name: string | null;
  employee_code: string | null;
  role: Role;
  status: string;
  allowed_stations: WorkflowStage[] | null;
}

function StationChip({
  value,
  label,
  on,
  onToggle,
}: {
  value: string;
  label: string;
  on: boolean;
  onToggle: (next: boolean) => void;
}) {
  return (
    <label className="cursor-pointer" aria-pressed={on}>
      <input
        type="checkbox"
        name="allowed_stations"
        value={value}
        checked={on}
        onChange={(e) => onToggle(e.target.checked)}
        className="sr-only"
      />
      <span
        className={cn(
          "inline-flex select-none items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-semibold transition-all",
          on
            ? "border-transparent bg-emerald-500 text-white shadow-sm shadow-emerald-500/30 hover:bg-emerald-600"
            : "border-dashed border-[var(--border)] bg-[var(--surface-2)] text-muted hover:border-[var(--accent)] hover:text-foreground",
        )}
      >
        <span
          className={cn(
            "grid h-4 w-4 place-items-center rounded-full",
            on ? "bg-white/25" : "border border-current opacity-60",
          )}
        >
          {on ? <Check className="h-3 w-3" strokeWidth={3} /> : <Plus className="h-3 w-3" />}
        </span>
        {label}
      </span>
    </label>
  );
}

export function EmployeeForm({
  mode,
  initial,
}: {
  mode: "create" | "edit";
  initial?: EmployeeInitial;
}) {
  const t = useT();
  const router = useRouter();
  const [state, formAction, pending] = useActionState<EmployeeState, FormData>(saveEmployee, {});
  const last = useRef(state);
  const isEdit = mode === "edit";

  useEffect(() => {
    if (state !== last.current) {
      last.current = state;
      if (state.ok) {
        router.push("/admin/employees");
        router.refresh();
      }
    }
  }, [state, router]);

  const [activeStations, setActiveStations] = useState<Set<string>>(
    () => new Set(initial?.allowed_stations ?? []),
  );
  const toggleStation = (value: string, next: boolean) =>
    setActiveStations((prev) => {
      const copy = new Set(prev);
      if (next) copy.add(value);
      else copy.delete(value);
      return copy;
    });
  const field =
    "ring-accent w-full rounded-2xl border border-[var(--border)] bg-[var(--surface-2)] px-4 text-sm text-foreground focus:border-[var(--accent)] h-[var(--control-h)]";

  return (
    <div className="mx-auto w-full max-w-2xl">
      <Link
        href={isEdit && initial ? `/admin/employees/${initial.id}` : "/admin/employees"}
        className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted transition-colors hover:text-[var(--accent)]"
      >
        <ArrowLeft className="h-4 w-4 flip-rtl" />
        {t("emp.back")}
      </Link>

      <GlassCard>
        <div className="mb-5 flex items-center gap-2">
          <span className="grid h-9 w-9 place-items-center rounded-xl bg-accent-gradient text-[var(--accent-contrast)]">
            {isEdit ? <Pencil className="h-4 w-4" /> : <UserPlus className="h-4 w-4" />}
          </span>
          <h2 className="font-display text-lg font-semibold text-foreground">
            {isEdit ? t("emp.edit") : t("emp.new")}
          </h2>
        </div>

        {state.error && (
          <div className="mb-3 flex items-start gap-2 rounded-2xl border border-rose-500/30 bg-rose-500/10 px-3 py-2.5 text-sm text-rose-600 dark:text-rose-400">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{state.error}</span>
          </div>
        )}

        <form action={formAction} className="space-y-4">
          {isEdit && initial && <input type="hidden" name="id" value={initial.id} />}

          <Input name="name" label={t("emp.name")} placeholder="Jane Doe" defaultValue={initial?.full_name ?? ""} />

          {!isEdit && (
            <Input name="email" type="email" required label={t("emp.email")} placeholder="jane@icon.app" />
          )}

          <div className="grid gap-4 sm:grid-cols-2">
            <Input
              name="password"
              type="text"
              required={!isEdit}
              label={isEdit ? t("emp.resetPassword") : t("emp.password")}
              placeholder="min. 8 characters"
            />
            <Input
              name="employee_code"
              label={t("emp.code")}
              placeholder="EMP-001"
              defaultValue={initial?.employee_code ?? ""}
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block">
              <span className="mb-1.5 block text-sm font-medium text-muted">{t("emp.role")}</span>
              <select name="role" defaultValue={initial?.role ?? "operator"} className={field}>
                {ROLES.map((r) => (
                  <option key={r} value={r}>
                    {t(`role.${r}` as DictKey)}
                  </option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="mb-1.5 block text-sm font-medium text-muted">{t("emp.statusLabel")}</span>
              <select name="status" defaultValue={initial?.status ?? "active"} className={field}>
                {USER_STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {t(`emp.status.${s}` as DictKey)}
                  </option>
                ))}
              </select>
            </label>
          </div>

          {/* Allowed stations (postes autorisés) */}
          <div>
            <div className="mb-1 flex items-center gap-2">
              <span className="text-sm font-medium text-muted">{t("emp.stations")}</span>
              <span
                className={cn(
                  "inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold",
                  activeStations.size > 0
                    ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
                    : "bg-[var(--surface-2)] text-faint",
                )}
              >
                {activeStations.size > 0
                  ? `${activeStations.size} / ${WORKFLOW_STAGES.length}`
                  : t("emp.stationsNone")}
              </span>
            </div>
            <p className="mb-2 text-xs text-faint">{t("emp.stationsHint")}</p>
            <div className="flex flex-wrap gap-2">
              {WORKFLOW_STAGES.map((s) => (
                <StationChip
                  key={s}
                  value={s}
                  label={t(`stage.${s}` as DictKey)}
                  on={activeStations.has(s)}
                  onToggle={(next) => toggleStation(s, next)}
                />
              ))}
            </div>
          </div>

          <div className="flex gap-2 pt-2">
            <Button type="submit" disabled={pending}>
              {isEdit ? t("emp.save") : t("emp.create")}
            </Button>
            <Link href={isEdit && initial ? `/admin/employees/${initial.id}` : "/admin/employees"}>
              <Button type="button" variant="glass">
                {t("emp.cancel")}
              </Button>
            </Link>
          </div>
        </form>
      </GlassCard>
    </div>
  );
}
