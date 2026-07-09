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
import { UserPlus, Eye, Pencil, Trash2, Loader2 } from "lucide-react";

export interface EmployeeRow {
  id: string;
  full_name: string | null;
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

function DeleteButton({ id, name }: { id: string; name: string }) {
  const t = useT();
  const router = useRouter();
  const [pending, start] = useTransition();
  const [err, setErr] = useState<string | null>(null);

  const onDelete = () => {
    if (!window.confirm(t("emp.confirmDelete").replace("{name}", name))) return;
    start(async () => {
      const res = await deleteEmployee(id);
      if (res.error) setErr(res.error);
      else router.refresh();
    });
  };

  return (
    <button
      onClick={onDelete}
      disabled={pending}
      title={err ?? t("emp.delete")}
      className="ring-accent grid h-8 w-8 place-items-center rounded-lg text-faint transition-colors hover:bg-rose-500/10 hover:text-rose-500 disabled:opacity-50"
    >
      {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
    </button>
  );
}

export function EmployeesList({ employees }: { employees: EmployeeRow[] }) {
  const t = useT();

  return (
    <>
      <PageHeader title={t("admin.employees")} subtitle={t("admin.subtitle")}>
        <Link href="/admin/employees/new">
          <Button size="sm">
            <UserPlus className="h-4 w-4" />
            {t("emp.new")}
          </Button>
        </Link>
      </PageHeader>

      <GlassCard padded={false} className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-sm">
            <thead>
              <tr className="border-b border-[var(--border)] text-start text-xs uppercase tracking-wide text-faint">
                <th className="px-5 py-3 text-start font-medium">{t("emp.name")}</th>
                <th className="px-5 py-3 text-start font-medium">{t("emp.role")}</th>
                <th className="px-5 py-3 text-start font-medium">{t("emp.stations")}</th>
                <th className="px-5 py-3 text-start font-medium">{t("common.status")}</th>
                <th className="px-5 py-3 text-end font-medium">{t("common.actions")}</th>
              </tr>
            </thead>
            <tbody>
              {employees.map((e) => (
                <tr key={e.id} className="border-b border-[var(--border)] last:border-0 hover:bg-[var(--surface-2)]">
                  <td className="px-5 py-3">
                    <Link href={`/admin/employees/${e.id}`} className="flex items-center gap-3">
                      <Avatar initials={initials(e.full_name, e.employee_code || "U")} size="sm" hue={(e.id.charCodeAt(0) * 7) % 360} />
                      <div className="min-w-0">
                        <div className="truncate font-medium text-foreground">{e.full_name ?? "—"}</div>
                        <div className="truncate text-xs text-faint">{e.employee_code ?? ""}</div>
                      </div>
                    </Link>
                  </td>
                  <td className="px-5 py-3 text-muted">{t(`role.${e.role}` as DictKey)}</td>
                  <td className="px-5 py-3 text-muted">{e.allowed_stations?.length ?? 0}</td>
                  <td className="px-5 py-3">
                    <Badge tone={STATUS_TONE[e.status] ?? "neutral"} dot>
                      {t(`emp.status.${e.status}` as DictKey)}
                    </Badge>
                  </td>
                  <td className="px-5 py-3">
                    <div className="flex items-center justify-end gap-1">
                      <Link
                        href={`/admin/employees/${e.id}`}
                        title={t("emp.view")}
                        className="ring-accent grid h-8 w-8 place-items-center rounded-lg text-faint transition-colors hover:bg-[var(--accent-soft)] hover:text-[var(--accent)]"
                      >
                        <Eye className="h-4 w-4" />
                      </Link>
                      <Link
                        href={`/admin/employees/${e.id}/edit`}
                        title={t("emp.edit")}
                        className="ring-accent grid h-8 w-8 place-items-center rounded-lg text-faint transition-colors hover:bg-[var(--accent-soft)] hover:text-[var(--accent)]"
                      >
                        <Pencil className="h-4 w-4" />
                      </Link>
                      <DeleteButton id={e.id} name={e.full_name ?? e.employee_code ?? "—"} />
                    </div>
                  </td>
                </tr>
              ))}
              {employees.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-5 py-12 text-center text-sm text-faint">
                    {t("common.empty")}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </GlassCard>
    </>
  );
}
