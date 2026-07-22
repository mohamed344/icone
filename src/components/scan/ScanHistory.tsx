"use client";

import { useMemo, useState } from "react";
import { useT, type DictKey } from "@/lib/i18n";
import { PageHeader } from "@/components/ui/PageHeader";
import { GlassCard } from "@/components/ui/GlassCard";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { cn } from "@/lib/cn";
import { WORKFLOW_STAGES } from "@/lib/workflow";
import { Clock, CalendarDays, Calendar, CalendarRange, ScanLine, Filter, X, Layers } from "lucide-react";

export interface HistScan {
  id: string;
  code: string;
  stage: string;
  result: string;
  scanned_at: string;
  /** Scanner's name — present only in the line-wide (chef/admin) view. */
  who?: string | null;
}

type Gran = "hours" | "days" | "months" | "years";

const pad = (n: number) => String(n).padStart(2, "0");

/** Date → value string for <input type="datetime-local"> in LOCAL time. */
function toLocalInput(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

interface Group {
  key: string;
  full: string;
  items: HistScan[];
}

export function ScanHistory({ scans, scope = "own" }: { scans: HistScan[]; scope?: "all" | "own" }) {
  const t = useT();
  const locale = t.lang === "fr" ? "fr-FR" : t.lang === "ar" ? "ar" : "en-US";
  const [gran, setGran] = useState<Gran>("days");
  const [selected, setSelected] = useState<string | null>(null);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  // Per-step separation — supervisors (line-wide view) can isolate one of the
  // 11 workflow steps. Operators see their own scans without this control.
  const [stage, setStage] = useState<string | null>(null);
  const showSteps = scope === "all";

  // --- Range filter -----------------------------------------------------------
  const fromTs = from ? new Date(from).getTime() : null;
  const toTs = to ? new Date(to).getTime() : null;
  const hasFilter = fromTs != null || toTs != null || stage != null;

  // Date-range filter first — step counts reflect the selected range, not the
  // currently isolated step.
  const dateFiltered = useMemo(
    () =>
      scans.filter((s) => {
        const ts = new Date(s.scanned_at).getTime();
        if (fromTs != null && ts < fromTs) return false;
        if (toTs != null && ts > toTs) return false;
        return true;
      }),
    [scans, fromTs, toTs],
  );

  const stageCounts = useMemo(() => {
    const m = new Map<string, number>();
    for (const s of dateFiltered) m.set(s.stage, (m.get(s.stage) ?? 0) + 1);
    return m;
  }, [dateFiltered]);

  const filtered = useMemo(
    () => (stage ? dateFiltered.filter((s) => s.stage === stage) : dateFiltered),
    [dateFiltered, stage],
  );

  function preset(kind: "today" | "7d" | "30d" | "year") {
    const now = new Date();
    const start = new Date();
    if (kind === "today") start.setHours(0, 0, 0, 0);
    else if (kind === "7d") start.setDate(start.getDate() - 7);
    else if (kind === "30d") start.setDate(start.getDate() - 30);
    else start.setMonth(0, 1), start.setHours(0, 0, 0, 0);
    setFrom(toLocalInput(start));
    setTo(toLocalInput(now));
    setSelected(null);
  }

  function clearFilter() {
    setFrom("");
    setTo("");
    setStage(null);
    setSelected(null);
  }

  function labelFor(d: Date, g: Gran): { key: string; full: string } {
    const y = d.getFullYear();
    if (g === "years") return { key: `${y}`, full: `${y}` };
    if (g === "months")
      return {
        key: `${y}-${d.getMonth()}`,
        full: new Intl.DateTimeFormat(locale, { month: "long", year: "numeric" }).format(d),
      };
    if (g === "days")
      return {
        key: `${y}-${d.getMonth()}-${d.getDate()}`,
        full: new Intl.DateTimeFormat(locale, { weekday: "long", day: "2-digit", month: "long", year: "numeric" }).format(d),
      };
    return {
      key: `${y}-${d.getMonth()}-${d.getDate()}-${d.getHours()}`,
      full: `${new Intl.DateTimeFormat(locale, { day: "2-digit", month: "short" }).format(d)} · ${pad(d.getHours())}:00`,
    };
  }

  const groups: Group[] = useMemo(() => {
    const map = new Map<string, Group>();
    for (const s of filtered) {
      const { key, full } = labelFor(new Date(s.scanned_at), gran);
      let g = map.get(key);
      if (!g) {
        g = { key, full, items: [] };
        map.set(key, g);
      }
      g.items.push(s);
    }
    return Array.from(map.values());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filtered, gran, locale]);

  const maxCount = Math.max(1, ...groups.map((g) => g.items.length));
  const activeKey = groups.find((g) => g.key === selected)?.key ?? groups[0]?.key ?? null;
  const active = groups.find((g) => g.key === activeKey) ?? null;

  const segs = [
    { value: "hours" as const, label: t("history.hours"), icon: <Clock className="h-4 w-4" /> },
    { value: "days" as const, label: t("history.days"), icon: <CalendarDays className="h-4 w-4" /> },
    { value: "months" as const, label: t("history.months"), icon: <Calendar className="h-4 w-4" /> },
    { value: "years" as const, label: t("history.years"), icon: <CalendarRange className="h-4 w-4" /> },
  ];

  const presets: { k: "today" | "7d" | "30d" | "year"; label: string }[] = [
    { k: "today", label: t("history.today") },
    { k: "7d", label: t("history.last7") },
    { k: "30d", label: t("history.last30") },
    { k: "year", label: t("history.thisYear") },
  ];

  const inputCls =
    "ring-accent h-11 w-full rounded-2xl border border-[var(--border)] bg-[var(--surface-2)] px-3 text-sm text-foreground focus:border-[var(--accent)]";

  return (
    <>
      <PageHeader title={t("history.title")} subtitle={t(scope === "all" ? "history.subtitleAll" : "history.subtitle")}>
        <Badge tone="accent">
          {filtered.length} {t("history.scans")}
        </Badge>
      </PageHeader>

      {/* Filters */}
      <GlassCard className="flex flex-col gap-4">
        <div className="flex flex-wrap items-end gap-3">
          <label className="min-w-[10rem] flex-1">
            <span className="mb-1.5 flex items-center gap-1.5 text-sm font-medium text-muted">
              <Filter className="h-3.5 w-3.5" /> {t("history.from")}
            </span>
            <input type="datetime-local" value={from} max={to || undefined} onChange={(e) => { setFrom(e.target.value); setSelected(null); }} className={inputCls} />
          </label>
          <label className="min-w-[10rem] flex-1">
            <span className="mb-1.5 block text-sm font-medium text-muted">{t("history.to")}</span>
            <input type="datetime-local" value={to} min={from || undefined} onChange={(e) => { setTo(e.target.value); setSelected(null); }} className={inputCls} />
          </label>
          {hasFilter && (
            <Button variant="glass" onClick={clearFilter}>
              <X className="h-4 w-4" /> {t("history.clear")}
            </Button>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {presets.map((p) => (
            <button
              key={p.k}
              onClick={() => preset(p.k)}
              className="ring-accent rounded-xl border border-[var(--border)] bg-[var(--surface-2)] px-3 py-1.5 text-xs font-medium text-muted transition-colors hover:border-[var(--accent)] hover:text-[var(--accent)]"
            >
              {p.label}
            </button>
          ))}
          <div className="ms-auto overflow-x-auto">
            <SegmentedControl<Gran> value={gran} onChange={(g) => { setGran(g); setSelected(null); }} segments={segs} />
          </div>
        </div>
      </GlassCard>

      {/* Per-step separation (line-wide supervisor view) — isolate any of the 11 steps */}
      {showSteps && (
        <GlassCard className="flex flex-col gap-3">
          <span className="flex items-center gap-1.5 text-sm font-medium text-muted">
            <Layers className="h-4 w-4" /> {t("history.steps")}
          </span>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => { setStage(null); setSelected(null); }}
              className={cn(
                "ring-accent inline-flex items-center gap-2 rounded-xl border px-3 py-1.5 text-xs font-medium transition-colors",
                stage === null
                  ? "border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--accent)]"
                  : "border-[var(--border)] bg-[var(--surface-2)] text-muted hover:border-[var(--accent)] hover:text-[var(--accent)]",
              )}
            >
              {t("history.allSteps")}
              <span className="rounded-full bg-[var(--surface)] px-1.5 py-0.5 text-[0.65rem] font-semibold text-faint">
                {dateFiltered.length}
              </span>
            </button>
            {WORKFLOW_STAGES.map((st) => {
              const count = stageCounts.get(st) ?? 0;
              const isActive = stage === st;
              return (
                <button
                  key={st}
                  onClick={() => { setStage(isActive ? null : st); setSelected(null); }}
                  className={cn(
                    "ring-accent inline-flex items-center gap-2 rounded-xl border px-3 py-1.5 text-xs font-medium transition-colors",
                    isActive
                      ? "border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--accent)]"
                      : count === 0
                        ? "border-[var(--border)] bg-[var(--surface-2)] text-faint hover:border-[var(--accent)]"
                        : "border-[var(--border)] bg-[var(--surface-2)] text-muted hover:border-[var(--accent)] hover:text-[var(--accent)]",
                  )}
                >
                  {t(`stage.${st}` as DictKey)}
                  <span className="rounded-full bg-[var(--surface)] px-1.5 py-0.5 text-[0.65rem] font-semibold text-faint">
                    {count}
                  </span>
                </button>
              );
            })}
          </div>
        </GlassCard>
      )}

      {filtered.length === 0 ? (
        <GlassCard>
          <div className="rounded-2xl border border-dashed border-[var(--border)] py-12 text-center text-sm text-faint">
            {hasFilter ? t("history.noneInRange") : t("history.empty")}
          </div>
        </GlassCard>
      ) : (
        <div className="grid gap-4 lg:grid-cols-5">
          {/* Periods list */}
          <GlassCard padded={false} className="overflow-hidden lg:col-span-2">
            <div className="border-b border-[var(--border)] px-4 py-3 text-xs font-semibold uppercase tracking-wide text-faint">
              {t("history.perPeriod")}
            </div>
            <ul className="max-h-[32rem] overflow-y-auto p-2">
              {groups.map((g) => {
                const isActive = g.key === activeKey;
                return (
                  <li key={g.key}>
                    <button
                      onClick={() => setSelected(g.key)}
                      className={cn(
                        "ring-accent w-full rounded-2xl px-3 py-2.5 text-start transition-colors",
                        isActive ? "bg-[var(--accent-soft)]" : "hover:bg-[var(--surface-2)]",
                      )}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className={cn("truncate text-sm font-medium capitalize", isActive ? "text-[var(--accent)]" : "text-foreground")}>
                          {g.full}
                        </span>
                        <span className="shrink-0 text-xs font-semibold text-muted">{g.items.length}</span>
                      </div>
                      <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-[var(--surface-2)]">
                        <div className="h-full rounded-full bg-accent-gradient" style={{ width: `${(g.items.length / maxCount) * 100}%` }} />
                      </div>
                    </button>
                  </li>
                );
              })}
            </ul>
          </GlassCard>

          {/* Selected period scans */}
          <GlassCard padded={false} className="overflow-hidden lg:col-span-3">
            <div className="flex items-center justify-between border-b border-[var(--border)] px-5 py-3">
              <h3 className="truncate font-display font-semibold capitalize text-foreground">{active?.full ?? "—"}</h3>
              <Badge tone="neutral">{active?.items.length ?? 0}</Badge>
            </div>
            {active && active.items.length > 0 ? (
              <ul className="max-h-[32rem] divide-y divide-[var(--border)] overflow-y-auto">
                {active.items.map((s) => (
                  <li key={s.id} className="flex items-center gap-3 px-5 py-2.5">
                    <ScanLine className="h-4 w-4 shrink-0 text-faint" />
                    <span className="min-w-0 flex-1 truncate font-mono text-sm text-foreground">{s.code}</span>
                    {s.who && (
                      <span className="hidden whitespace-nowrap text-xs text-muted sm:inline">
                        {t("history.by")} {s.who}
                      </span>
                    )}
                    <Badge tone="accent">{t(`stage.${s.stage}` as DictKey)}</Badge>
                    <span className="whitespace-nowrap text-xs text-faint">
                      {new Date(s.scanned_at).toLocaleTimeString(locale, { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="py-12 text-center text-sm text-faint">{t("history.empty")}</div>
            )}
          </GlassCard>
        </div>
      )}
    </>
  );
}
