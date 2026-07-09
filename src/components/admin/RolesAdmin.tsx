"use client";

import { useActionState } from "react";
import { useRouter } from "next/navigation";
import { useEffect, useRef } from "react";
import { useT, type DictKey } from "@/lib/i18n";
import { PageHeader } from "@/components/ui/PageHeader";
import { GlassCard } from "@/components/ui/GlassCard";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { saveRolePermissions, type RolesState } from "@/app/(app)/admin/roles/actions";
import { PERMISSIONS, type Role, type Permission, type PermissionMap } from "@/lib/workflow";
import { ShieldCheck, AlertCircle, CheckCircle2, Lock } from "lucide-react";

export interface RoleRow {
  role: Role;
  permissions: PermissionMap;
  description: string | null;
}

function PermChip({
  role,
  perm,
  label,
  defaultChecked,
  disabled,
}: {
  role: Role;
  perm: Permission;
  label: string;
  defaultChecked: boolean;
  disabled?: boolean;
}) {
  return (
    <label className={disabled ? "cursor-not-allowed opacity-70" : "cursor-pointer"}>
      <input
        type="checkbox"
        name={`perm__${role}`}
        value={perm}
        defaultChecked={defaultChecked}
        disabled={disabled}
        className="peer sr-only"
      />
      <span className="inline-flex select-none items-center rounded-xl border border-[var(--border)] bg-[var(--surface-2)] px-3 py-1.5 text-xs font-medium text-muted transition-all peer-checked:border-transparent peer-checked:bg-accent-gradient peer-checked:text-[var(--accent-contrast)]">
        {label}
      </span>
    </label>
  );
}

export function RolesAdmin({ roles }: { roles: RoleRow[] }) {
  const t = useT();
  const router = useRouter();
  const [state, formAction, pending] = useActionState<RolesState, FormData>(saveRolePermissions, {});
  const last = useRef(state);

  useEffect(() => {
    if (state !== last.current) {
      last.current = state;
      if (state.ok) router.refresh();
    }
  }, [state, router]);

  return (
    <>
      <PageHeader title={t("roles.title")} subtitle={t("roles.subtitle")} />

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

      <form action={formAction} className="space-y-4">
        <div className="grid gap-4 lg:grid-cols-3">
          {roles.map((r) => {
            const isAdmin = r.role === "admin";
            return (
              <GlassCard key={r.role} className="flex flex-col gap-4">
                <div className="flex items-center gap-3">
                  <span className="grid h-10 w-10 place-items-center rounded-xl bg-[var(--accent-soft)] text-[var(--accent)]">
                    {isAdmin ? <Lock className="h-5 w-5" /> : <ShieldCheck className="h-5 w-5" />}
                  </span>
                  <div className="min-w-0">
                    <h3 className="font-display text-lg font-semibold text-foreground">
                      {t(`role.${r.role}` as DictKey)}
                    </h3>
                    {r.description && <p className="text-xs text-faint">{r.description}</p>}
                  </div>
                </div>

                {isAdmin && (
                  <Badge tone="neutral" dot>
                    {t("roles.adminLocked")}
                  </Badge>
                )}

                <div className="flex flex-wrap gap-2">
                  {PERMISSIONS.map((p) => (
                    <PermChip
                      key={p}
                      role={r.role}
                      perm={p}
                      label={t(`perm.${p}` as DictKey)}
                      defaultChecked={isAdmin ? true : Boolean(r.permissions[p])}
                      disabled={isAdmin}
                    />
                  ))}
                </div>
              </GlassCard>
            );
          })}
        </div>

        <Button type="submit" disabled={pending}>
          {t("common.save")}
        </Button>
      </form>
    </>
  );
}
