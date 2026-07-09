"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useT, type DictKey } from "@/lib/i18n";
import { PageHeader } from "@/components/ui/PageHeader";
import { GlassCard } from "@/components/ui/GlassCard";
import { Button } from "@/components/ui/Button";
import { Badge, type Tone } from "@/components/ui/Badge";
import { Avatar } from "@/components/ui/Avatar";
import { deleteEmployee } from "@/app/(app)/admin/employees/actions";
import type { Role, WorkflowStage } from "@/lib/workflow";
import { ArrowLeft, Pencil, Trash2, Loader2, Mail, IdCard } from "lucide-react";

export interface EmployeeDetail {
  id: string;
  full_name: string | null;
  email: string | null;
  employee_code: string | null;
  role: Role;
  status: string;
  allowed_stations: WorkflowStage[] | null;
}

const STATUS_TONE: Record<string, Tone> = {
  active: "success",
  pending: "warning",
  disabled: "neutral",
};

function initials(name: string | null, fallback: string) {
  const base = (name || fallback).trim();
  const p = base.split(/\s+/);
  return ((p[0]?.[0] ?? "") + (p[1]?.[0] ?? base[1] ?? "")).toUpperCase();
}

export function EmployeeDetails({ employee }: { employee: EmployeeDetail }) {
  const t = useT();
  const router = useRouter();
  const [pending, start] = useTransition();
  const [err, setErr] = useState<string | null>(null);

  const onDelete = () => {
    if (!window.confirm(t("emp.confirmDelete").replace("{name}", employee.full_name ?? "—"))) return;
    start(async () => {
      const res = await deleteEmployee(employee.id);
      if (res.error) setErr(res.error);
      else {
        router.push("/admin/employees");
        router.refresh();
      }
    });
  };

  const rows: { icon: React.ReactNode; label: string; value: string }[] = [
    { icon: <Mail className="h-4 w-4" />, label: t("emp.email"), value: employee.email ?? "—" },
    { icon: <IdCard className="h-4 w-4" />, label: t("emp.code"), value: employee.employee_code ?? "—" },
  ];

  return (
    <>
      <Link
        href="/admin/employees"
        className="inline-flex items-center gap-1.5 text-sm text-muted transition-colors hover:text-[var(--accent)]"
      >
        <ArrowLeft className="h-4 w-4 flip-rtl" />
        {t("emp.back")}
      </Link>

      <PageHeader title={employee.full_name ?? t("emp.list")}>
        <Link href={`/admin/employees/${employee.id}/edit`}>
          <Button size="sm" variant="glass">
            <Pencil className="h-4 w-4" />
            {t("emp.edit")}
          </Button>
        </Link>
        <Button size="sm" variant="glass" onClick={onDelete} disabled={pending}>
          {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4 text-rose-500" />}
          {t("emp.delete")}
        </Button>
      </PageHeader>

      {err && (
        <div className="rounded-2xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-600 dark:text-rose-400">
          {err}
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-3">
        <GlassCard className="flex flex-col items-center gap-3 text-center">
          <Avatar initials={initials(employee.full_name, employee.employee_code || "U")} size="lg" hue={(employee.id.charCodeAt(0) * 7) % 360} />
          <div>
            <div className="font-display text-lg font-semibold text-foreground">{employee.full_name ?? "—"}</div>
            <div className="text-sm text-muted">{t(`role.${employee.role}` as DictKey)}</div>
          </div>
          <Badge tone={STATUS_TONE[employee.status] ?? "neutral"} dot>
            {t(`emp.status.${employee.status}` as DictKey)}
          </Badge>
        </GlassCard>

        <GlassCard className="lg:col-span-2">
          <ul className="divide-y divide-[var(--border)]">
            {rows.map((r) => (
              <li key={r.label} className="flex items-center gap-3 py-3 first:pt-0 last:pb-0">
                <span className="grid h-9 w-9 place-items-center rounded-xl bg-[var(--accent-soft)] text-[var(--accent)]">
                  {r.icon}
                </span>
                <span className="text-sm text-faint">{r.label}</span>
                <span className="ms-auto truncate text-sm font-medium text-foreground">{r.value}</span>
              </li>
            ))}
          </ul>

          <div className="mt-4">
            <div className="mb-2 text-sm font-medium text-muted">{t("emp.stations")}</div>
            {employee.allowed_stations?.length ? (
              <div className="flex flex-wrap gap-2">
                {employee.allowed_stations.map((s) => (
                  <Badge key={s} tone="accent">
                    {t(`stage.${s}` as DictKey)}
                  </Badge>
                ))}
              </div>
            ) : (
              <p className="text-sm text-faint">{t("emp.none")}</p>
            )}
          </div>
        </GlassCard>
      </div>
    </>
  );
}
