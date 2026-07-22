# Spec — Staff-Activity Admin Dashboard

_Status: proposed. Scope: this document is the build spec; implementation is a follow-up._
_Grounded in [`docs/audit.md`](./audit.md). Every section names concrete, existing code paths to reuse._

---

## 1. Goal & scope

A new **`/admin/staff`** surface that answers **"who did what, when, on which entity"** and turns
the existing per-scan audit trail into staff analytics:

- **Activity feed** — per staff member: which stage, which entity, when, with what result.
- **Analytics** — output **per worker**, **per period** (date range), and **per production line**.
- **Role gate** — admin and supervisor (chef de ligne) can both view; operators cannot.

It builds directly on `scan_events` (the immutable who/what/when/entity log) and the existing
in-memory aggregator `getScanStats` (`src/lib/admin/stats.ts`), which already computes `activeToday`
and a top-8 `perEmployee` rollup — this spec generalizes that into a first-class, server-aggregated,
filterable dashboard with a per-worker drill-down.

### Resolved decisions (from planning)

| Question | Decision |
|---|---|
| **Period model** | **Date ranges only** — Today / 7d / 30d / custom `from`–`to`. No shift concept. |
| **Supervisor scope** | Supervisors see **all** staff. The gate separates admin (full) from supervisor (read-only view); no team/line-scoping model is built now. |
| **Migrations** | **Allowed** — add an index + an aggregation RPC. |
| **Output metric** | **Scan events performed**, grouped by stage. |

### Recorded defaults (not asked; stated here)

- **Attribution** = `scan_events.scanned_by` (the actor who recorded the scan). At cross-user
  QC/reception steps this is the QC/reception operator — correct for "who did what". A future
  "credit the original producer too" variant is out of scope (§8).
- **Production line** = an optional dimension/filter over `scan_events.line_id` / `profiles.line_id`.
  Line scoping was **removed in migration 0007**, so this data is currently **sparse**; the filter
  renders and works but may show a single "unassigned" bucket until lines are populated. A
  `scopeFilter` seam (§4) lets a future line/team scope drop into the query layer with no UI change.

---

## 2. Access control

Mirror the established admin-route pattern — every `src/app/(app)/admin/*/page.tsx` does
`await requireRole([...])` (`src/lib/auth/session.ts`) — with two deliberate changes:

1. **Widen the role set** to `["admin", "chef_de_ligne"]` so supervisors get in. `requireRole`
   already redirects a mismatched role to `roleHome(role)`, so an **operator hitting `/admin/staff`
   lands on `/operator`** (not `/login`).
2. **Enforce `view_reports`** — after the role check, call
   `if (!(await userCan(session.profile, "view_reports"))) redirect(roleHome(session.profile.role))`
   (`src/lib/auth/permissions.ts`). `view_reports` already exists in `PERMISSIONS`
   (`src/lib/workflow.ts`), is seeded `true` for admin and chef in `role_settings`
   (`supabase/migrations/0005`), and is **currently enforced nowhere** (audit §7.7). This dashboard
   is its first enforcement point, so a per-user revocation of `view_reports` correctly removes access.

**Both roles see all staff** (per the resolved decision). The admin↔supervisor distinction today is
only that the surface is read-only for everyone (no mutations exist on it); the widened gate is
future-proofing.

Gate helper to add (both `page.tsx` files call it):

```ts
// top of src/app/(app)/admin/staff/page.tsx and [id]/page.tsx
const session = await requireRole(["admin", "chef_de_ligne"]);
if (!(await userCan(session.profile, "view_reports"))) {
  redirect(roleHome(session.profile.role));
}
```

---

## 3. Data model & migration — `supabase/migrations/0017_staff_activity.sql`

Follows the migrations convention: next sequential number **0017**, idempotent / re-runnable,
hand-applied via the Supabase SQL editor (latest existing is `0016_unit_hold.sql`). **No new
tables or columns** — no shift model, no team model (per decisions).

**a. Index** — the audit's recommended index for per-staff aggregation:

```sql
create index if not exists idx_scan_events_actor_time
  on public.scan_events (scanned_by, scanned_at);
```

**b. Aggregation RPC** — server-side rollup replacing the in-memory loop:

```sql
create or replace function public.staff_activity(p_from timestamptz, p_to timestamptz)
returns table (
  scanned_by uuid,
  full_name  text,
  role       public.app_role,
  line_id    uuid,
  stage      public.workflow_stage,
  cnt        bigint,
  last_at    timestamptz
)
language sql
security invoker
stable
as $$
  select se.scanned_by,
         p.full_name,
         p.role,
         p.line_id,
         se.stage,
         count(*)          as cnt,
         max(se.scanned_at) as last_at
  from public.scan_events se
  join public.profiles p on p.id = se.scanned_by
  where se.scanned_at >= p_from
    and se.scanned_at <  p_to
  group by se.scanned_by, p.full_name, p.role, p.line_id, se.stage
$$;

grant execute on function public.staff_activity(timestamptz, timestamptz) to authenticated;
```

`security invoker` is safe because `scan_events` RLS already grants `select` to any authenticated
user (audit §3), and the dashboard is gated to admin/chef anyway. The function is `stable` and
returns **long-form** (one row per worker×stage); the app pivots to `perStage` in JS.

---

## 4. Aggregation layer — new `src/lib/admin/staff.ts`

Server module (`"server-only"`), same style as `src/lib/admin/stats.ts`: async functions using
`createClient()` (RLS client) and the same **name-map / midnight-window** idioms (`stats.ts` L63,
L83). It reuses `WORKFLOW_STAGES` and types from `src/lib/workflow.ts`.

### `dateRange`

```ts
export type RangePreset = "today" | "7d" | "30d";
export type Range = { from: Date; to: Date };
export function dateRange(input: RangePreset | { from: string; to: string }): Range;
```

Server-local midnight like `stats.ts` L63 (`setHours(0,0,0,0)`); `to` is exclusive (now, or the
custom end +1 day). Timezone = server-local (documented; consistent with existing stats).

### `getStaffActivity(range, opts?)`

```ts
export async function getStaffActivity(
  range: Range,
  opts?: { lineId?: string },
): Promise<{
  from: string; to: string;
  workers: Array<{
    userId: string; name: string; employeeCode: string | null;
    role: Role; lineId: string | null;
    total: number; perStage: Record<WorkflowStage, number>; lastActiveAt: string | null;
  }>;
  totals: { total: number; activeCount: number };
}>;
```

Calls `supabase.rpc("staff_activity", { p_from, p_to })`, pivots the long-form rows into per-worker
`perStage` + `total`, applies `scopeFilter` (below) and the optional `lineId` filter. **Fallback**:
if the RPC is missing (migration not yet applied), fall back to a `scan_events.select("scanned_by,
stage, scanned_at").gte(...).lt(...)` in-memory rollup identical in shape (so the UI works before
0017 is applied, just unindexed).

### `getStaffMemberDetail(userId, range)`

```ts
export async function getStaffMemberDetail(userId: string, range: Range): Promise<{
  worker: { userId: string; name: string; employeeCode: string | null; role: Role };
  perStage: Array<{ stage: WorkflowStage; count: number }>;
  perEntityType: Array<{ entityType: EntityType; count: number }>;   // container|box|item|carton|pallet|group
  daily: { labels: string[]; values: number[] };
  timeline: Array<{ at: string; stage: WorkflowStage; entityType: EntityType; code: string; result: ScanResult }>;
}>;
```

Reads `scan_events.select("stage, entity_type, entity_id, code, result, scanned_at")
.eq("scanned_by", userId).gte(...).lt(...).order("scanned_at", desc).limit(500)`. This is the
**who/what/when/entity** feed. Daily/ per-stage / per-entity are folded in JS (reuse the `daily`
bucketing from `stats.ts` L86–96).

### `getLineActivity(range)`

Per-`line_id` totals joined to `production_lines.name`. Returns `Array<{ lineId, lineName, total }>`.
**Sparse-data note in code + UI:** rows with null `line_id` group under an "Unassigned" bucket;
today most/all activity lands there because line scoping was removed in 0007.

### `scopeFilter(session, workers)`

A single seam: **today a no-op** (returns all workers — supervisors see everyone, per decision).
It is the one place a future line/team scope would filter the worker set, so the UI and callers
never change when that decision is revisited.

---

## 5. Routes & UI

### Pages

- **`src/app/(app)/admin/staff/page.tsx`** — server component. Gate (§2) → parse range from
  `searchParams` (`?range=7d` or `?from=…&to=…`, default `today`) and optional `?line=` →
  `getStaffActivity` (+ `getLineActivity` for the filter options) → render `<StaffDashboard>`.
  Mirrors `src/app/(app)/admin/analytics/page.tsx` structure exactly.
- **`src/app/(app)/admin/staff/[id]/page.tsx`** — server component. Same gate → `getStaffMemberDetail(params.id, range)` → render `<StaffMemberDetail>`. 404/empty-state if the id has no activity in range.

### Components

- **`src/components/admin/StaffDashboard.tsx`** (client) — props `{ data, lines, range }`:
  - A `SegmentedControl` (`src/components/ui/SegmentedControl.tsx`) for Today / 7d / 30d, a custom
    `from`–`to` pair, and an optional line `<select>`; changing any pushes a new `searchParams` URL
    (server re-fetch).
  - Two reused `StatCard`s (`src/components/ui/StatCard.tsx`): **Active staff** (`totals.activeCount`)
    and **Total scans in window** (`totals.total`) — the latter is the number AC7 checks.
  - A **sortable worker table**: Name · Role · Total · per-stage columns (or a compact top-stages
    cell) · Last active. Each row links to `/admin/staff/<userId>`.
- **`src/components/admin/StaffMemberDetail.tsx`** (client) — props `{ detail, range }`:
  - Header (name, role, employee code), a daily `Sparkline` (`src/components/charts/Sparkline.tsx`),
    per-stage and per-entity-type breakdown chips, and the **activity timeline table**
    (When · Stage · Entity type · Code · Result), newest first.

### Nav & i18n

- Add to the admin group in `src/components/layout/nav-config.tsx` (admin `items`, ~L45–56):
  `{ href: "/admin/staff", labelKey: "nav.staff", icon: UsersRound }` (import `UsersRound` from
  `lucide-react`).
- Add a **`nav.staff`** key (+ any new component labels, e.g. `staff.title`, `staff.lastActive`,
  `staff.timeline`, `staff.total`) to **all three locales** (en / ar / fr) in
  `src/lib/i18n/dictionaries.ts`. `en` is the typed source of truth (`DictKey`), so every key must
  be added there and mirrored in ar/fr.

---

## 6. Acceptance Criteria

Each criterion is a **single command** with a pass condition. Test scaffolding to add:

- **`tests/routes.json`** — add `{ "path": "/admin/staff", "role": "admin" }` and
  `{ "path": "/admin/staff", "role": "chef" }` (the responsive loop then covers them across
  375 / 768 / 1440 and asserts no `/login` bounce + no horizontal overflow).
- **`tests/staff.spec.ts`** — new Playwright spec. It reuses the existing per-role storage states
  `tests/.auth/{admin,chef,operator}.json` (created by `tests/global-setup.ts`) and builds a
  **service-role `@supabase/supabase-js` client from `.env.local`** exactly as `global-setup.ts`
  does (`NEXT_PUBLIC_SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY`) to cross-check aggregation.

Run order matters: **AC1 first** (generates `.next/types` so AC2's `tsc` is clean — the Next-16
codegen caveat from the audit). The dev server on `:3000` is reused by Playwright
(`playwright.config.ts`, `reuseExistingServer: true`).

| # | Command | Pass condition |
|---|---------|----------------|
| **AC1** | `npx next build` | Exits 0 — app compiles and `.next/types` is generated. |
| **AC2** | `npx tsc --noEmit` | Exits 0 — no type errors in `src/` (run after AC1). |
| **AC3** | `npx playwright test tests/staff.spec.ts` | Exits 0 — the suite below (AC4–AC9) passes. |
| **AC4** | _(staff.spec)_ admin `goto /admin/staff` | `page.url()` does not contain `/login`; a worker `<table>` (or `[data-test=staff-table]`) is visible. |
| **AC5** | _(staff.spec)_ chef `goto /admin/staff` | Renders (supervisor view allowed); URL pathname is `/admin/staff`. |
| **AC6** | _(staff.spec)_ operator `goto /admin/staff` | `new URL(page.url()).pathname === "/operator"` (role gate redirect). |
| **AC7** | _(staff.spec)_ aggregation correctness | The "Total scans in window" tile equals the in-test service-role query `select count(*) from scan_events where scanned_at >= from and scanned_at < to` for the default (today) range. |
| **AC8** | _(staff.spec)_ switch range Today → 7d | The tile updates and equals the in-test SQL count recomputed for the 7d window. |
| **AC9** | _(staff.spec)_ click a worker row | Navigates to `/admin/staff/<id>`; the detail's per-stage totals sum to that worker's row `total` from the dashboard. |
| **AC10** | `npx playwright test tests/responsive.spec.ts` | Exits 0 — with `/admin/staff` added to `routes.json`, no horizontal overflow at 375 / 768 / 1440 and no `/login` bounce. |
| **AC11** | Supabase MCP `execute_sql`: `select indexname from pg_indexes where indexname = 'idx_scan_events_actor_time'` | Returns exactly 1 row — migration 0017's index is applied. |
| **AC12** | Supabase MCP `execute_sql`: `select 1 from pg_proc where proname = 'staff_activity'` | Returns 1 row — the RPC exists. |

> Note on AC7/AC8: comparing the rendered tile to a service-role `count(*)` is the correctness
> check that substitutes for a unit test — the project has **no unit-test runner** (only Playwright),
> and no local Supabase stack, so cross-checks go through the service-role client or the Supabase MCP.

---

## 7. Reused vs. new files

**New (created at implementation time):**
- `supabase/migrations/0017_staff_activity.sql`
- `src/lib/admin/staff.ts`
- `src/app/(app)/admin/staff/page.tsx`, `src/app/(app)/admin/staff/[id]/page.tsx`
- `src/components/admin/StaffDashboard.tsx`, `src/components/admin/StaffMemberDetail.tsx`
- `tests/staff.spec.ts`

**Modified:**
- `src/components/layout/nav-config.tsx` (one admin nav item)
- `src/lib/i18n/dictionaries.ts` (new keys × en/ar/fr)
- `tests/routes.json` (two entries)

**Reused unchanged:**
- `src/lib/admin/stats.ts` (name-map + daily-bucket idioms), `src/lib/auth/session.ts`
  (`requireRole`, `roleHome`), `src/lib/auth/permissions.ts` (`userCan`), `src/lib/workflow.ts`
  (`WORKFLOW_STAGES`, `PERMISSIONS`, `view_reports`), `src/components/ui/{StatCard,SegmentedControl}.tsx`,
  `src/components/charts/Sparkline.tsx`, `tests/global-setup.ts` (auth states + service-role pattern).

---

## 8. Out of scope (deferred decisions)

- **Shifts / presence / hours worked** — no shift or clock-in model; "period" is date-range only.
- **Team / line scoping of the supervisor view** — supervisors see all staff; the `scopeFilter`
  seam (§4) is where a future `line_id`/team scope would live. Depends on `profiles.line_id` being
  populated (sparse since 0007).
- **Alternate attribution** (crediting the original producer at cross-user QC/reception steps in
  addition to `scanned_by`).
- **CSV / export** and **unifying `qc_checks` / `carton_movements` / `unit_movements`** into the
  timeline (v1 uses `scan_events` alone).
- **Materialized view** — 0017 ships an index + `stable` RPC; a materialized view is a later
  optimization if volume demands it.
