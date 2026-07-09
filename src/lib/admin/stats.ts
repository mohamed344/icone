import "server-only";
import { createClient } from "@/lib/supabase/server";
import { WORKFLOW_STAGES, type WorkflowStage } from "@/lib/workflow";

export interface ScanStats {
  totalToday: number;
  activeToday: number;
  windowTotal: number;
  avgGapMin: number;
  daysCount: number;
  daily: { labels: string[]; values: number[] };
  perStep: { stage: WorkflowStage; count: number }[];
  perEmployee: { name: string; count: number }[];
  recent: { code: string; stage: WorkflowStage; at: string; who: string }[];
}

/** Aggregates scan_events over the last `days` days (admin sees all via RLS). */
export async function getScanStats(days = 14): Promise<ScanStats> {
  const supabase = await createClient();

  const startToday = new Date();
  startToday.setHours(0, 0, 0, 0);
  const since = new Date(startToday);
  since.setDate(since.getDate() - (days - 1));

  const [rowsRes, profsRes] = await Promise.all([
    supabase
      .from("scan_events")
      .select("code, stage, scanned_by, scanned_at")
      .gte("scanned_at", since.toISOString())
      .order("scanned_at", { ascending: true }),
    supabase.from("profiles").select("id, full_name"),
  ]);

  const list = (rowsRes.data ?? []) as {
    code: string;
    stage: WorkflowStage;
    scanned_by: string | null;
    scanned_at: string;
  }[];
  const nameById = new Map((profsRes.data ?? []).map((p) => [p.id, p.full_name ?? "—"]));

  // Day buckets (oldest → newest)
  const dayKeys: string[] = [];
  const labels: string[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(startToday);
    d.setDate(d.getDate() - i);
    dayKeys.push(`${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`);
    labels.push(`${d.getMonth() + 1}/${d.getDate()}`);
  }
  const dayIndex = new Map(dayKeys.map((k, i) => [k, i]));
  const values = new Array(days).fill(0);

  let totalToday = 0;
  const activeToday = new Set<string>();
  const stepCount = new Map<WorkflowStage, number>();
  const empCount = new Map<string, number>();
  const codeTimes = new Map<string, number[]>();

  for (const r of list) {
    const d = new Date(r.scanned_at);
    const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
    const idx = dayIndex.get(key);
    if (idx != null) values[idx]++;

    if (d >= startToday) {
      totalToday++;
      if (r.scanned_by) activeToday.add(r.scanned_by);
    }
    stepCount.set(r.stage, (stepCount.get(r.stage) ?? 0) + 1);
    if (r.scanned_by) empCount.set(r.scanned_by, (empCount.get(r.scanned_by) ?? 0) + 1);
    if (r.code) {
      const arr = codeTimes.get(r.code) ?? [];
      arr.push(d.getTime());
      codeTimes.set(r.code, arr);
    }
  }

  // Average elapsed time between a product's consecutive scans.
  let gapSum = 0;
  let gapCount = 0;
  for (const arr of codeTimes.values()) {
    arr.sort((a, b) => a - b);
    for (let i = 1; i < arr.length; i++) {
      gapSum += arr[i] - arr[i - 1];
      gapCount++;
    }
  }
  const avgGapMin = gapCount ? Math.round(gapSum / gapCount / 60000) : 0;

  const perEmployee = [...empCount.entries()]
    .map(([id, count]) => ({ name: nameById.get(id) ?? "—", count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 8);

  const recent = list
    .slice(-12)
    .reverse()
    .map((r) => ({
      code: r.code,
      stage: r.stage,
      at: r.scanned_at,
      who: r.scanned_by ? (nameById.get(r.scanned_by) ?? "—") : "—",
    }));

  return {
    totalToday,
    activeToday: activeToday.size,
    windowTotal: list.length,
    avgGapMin,
    daysCount: days,
    daily: { labels, values },
    perStep: WORKFLOW_STAGES.map((stage) => ({ stage, count: stepCount.get(stage) ?? 0 })),
    perEmployee,
    recent,
  };
}
