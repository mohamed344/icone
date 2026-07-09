"use client";

import { useT } from "@/lib/i18n";
import { PageHeader } from "@/components/ui/PageHeader";
import { Button } from "@/components/ui/Button";
import { Avatar } from "@/components/ui/Avatar";
import { Badge } from "@/components/ui/Badge";
import { taskBoard } from "@/lib/mock-data";
import { Plus, Clock } from "lucide-react";

const COLUMN_DOT: Record<string, string> = {
  backlog: "var(--muted)",
  inProgress: "var(--accent)",
  review: "#f59e0b",
  done: "#10b981",
};

export default function TasksPage() {
  const t = useT();
  return (
    <>
      <PageHeader title={t("tasks.title")} subtitle={t("tasks.subtitle")}>
        <Button size="sm">
          <Plus className="h-4 w-4" />
          {t("common.new")}
        </Button>
      </PageHeader>

      <div className="-mx-1 flex gap-4 overflow-x-auto pb-2">
        {taskBoard.map((col) => (
          <div key={col.key} className="flex w-[19rem] shrink-0 flex-col gap-3 px-1">
            <div className="flex items-center justify-between px-1">
              <div className="flex items-center gap-2">
                <span className="h-2.5 w-2.5 rounded-full" style={{ background: COLUMN_DOT[col.key] }} />
                <span className="font-display font-semibold text-foreground">{t(col.titleKey)}</span>
                <span className="text-xs text-faint">{col.tasks.length}</span>
              </div>
              <button className="ring-accent grid h-7 w-7 place-items-center rounded-lg text-faint hover:bg-[var(--accent-soft)] hover:text-[var(--accent)]">
                <Plus className="h-4 w-4" />
              </button>
            </div>

            <div className="flex flex-col gap-3">
              {col.tasks.map((task) => (
                <div
                  key={task.id}
                  className="glass-card hover-lift cursor-grab p-4 active:cursor-grabbing"
                >
                  <div className="mb-2 flex items-center justify-between">
                    <Badge tone="accent">{task.tag}</Badge>
                    <span className="font-mono text-xs text-faint">{task.id}</span>
                  </div>
                  <p className="text-sm font-medium leading-snug text-foreground">{task.title}</p>
                  <div className="mt-3 flex items-center justify-between">
                    <span className="flex items-center gap-1.5 text-xs text-faint">
                      <Clock className="h-3.5 w-3.5" />
                      {task.due}
                    </span>
                    <Avatar initials={task.assignee} hue={task.hue} size="sm" />
                  </div>
                </div>
              ))}
              {col.tasks.length === 0 && (
                <div className="rounded-2xl border border-dashed border-[var(--border)] py-8 text-center text-xs text-faint">
                  {t("common.empty")}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </>
  );
}
