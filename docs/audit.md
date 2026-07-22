# Codebase Audit — ICONE Production Traceability

_Read-only investigation. Prepared to scope a **staff-activity admin dashboard**._

---

## 1. Stack

| Concern | Finding |
|---|---|
| **Framework** | Next.js **16.2.9** (App Router, React Server Components + Server Actions). React **19.2.4**. TypeScript 5, `strict: true` (no `noUnusedLocals`). |
| **Supabase** | `@supabase/ssr` **^0.12.0** (cookie-based SSR sessions) + `@supabase/supabase-js` **^2.110.7**. Two server clients: `createClient()` (RLS-respecting, user cookies) in `src/lib/supabase/server.ts`, and `createAdminClient()` (service-role, **bypasses RLS**) in `src/lib/supabase/admin.ts`. Env: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SERVICE_ROLE_KEY`. |
| **Styling** | Tailwind CSS **v4** (`@tailwindcss/postcss`), design tokens as CSS custom properties in `globals.css`, light/dark + theme presets via `src/lib/theme/*`. UI primitives in `src/components/ui/*` (GlassCard, Button, Badge, StatCard, SegmentedControl…). Icons: `lucide-react`. Charts: hand-rolled `src/components/charts/Sparkline.tsx` (no chart lib). Barcodes/QR: `react-barcode`, `qrcode.react`. |
| **Test setup** | **Playwright** (`@playwright/test` ^1.61.1) is configured: `playwright.config.ts` (reuses the dev server on :3000), `tests/responsive.spec.ts` (responsive/overflow suite), `tests/global-setup.ts` (creates 3 role-scoped test users via the service-role key + captures auth storage state), `tests/routes.json`. **No Vitest / Jest / unit-test runner.** No component or server-action unit tests. `package.json` scripts are only `dev` / `build` / `start` (run Playwright via `npx playwright test`). |
| **i18n** | Hand-rolled dictionary `src/lib/i18n/dictionaries.ts` (en / ar / fr), `en` object is the typed source of truth (`DictKey`). RTL for Arabic. |

**Note:** `next build` currently fails at the **generated-types** typecheck step (`.next/dev/types/routes.d.ts`, a Next 16 codegen quirk) — unrelated to app code; `npx tsc --noEmit` on `src/` is clean.

---

## 2. Auth, roles & permissions

- **Authentication:** Supabase email/password. `src/app/(auth)/actions.ts` → `signIn` (`signInWithPassword`, checks `profiles.status !== 'disabled'`, then `redirect(roleHome(role))`), `bootstrapRegister` (first-user-becomes-admin via `registration_open()` RPC), `signOut`.
- **No middleware.** Gating is per-request in server components: `src/lib/auth/session.ts` → `requireUser()` (`redirect('/login')` if no session) and `requireRole(roles[])` (`redirect(roleHome(role))` if wrong role). The `(app)/layout.tsx` calls `requireUser()`, so **every app route requires a session**; role-specific pages add `requireRole`.
- **Roles** (`src/lib/workflow.ts`): `ROLES = ["operator", "chef_de_ligne", "admin"]` — Postgres enum `app_role`. `roleHome`: admin→`/admin`, chef→`/chef`, operator→`/operator`.
- **Permissions concept — yes, two layers:**
  - **Per-role** defaults in `role_settings` table + `src/lib/workflow.ts::defaultPermissions()`; read via `src/lib/auth/permissions.ts::roleCan(role, key)` (admin always true).
  - **Per-employee** overrides in `profiles.permissions` (jsonb) — currently only `approve_rejected` is edited in the UI (Employees form). Resolved via `permissions.ts::userCan(profile, key)` (admin OR per-employee grant OR role grant).
  - `PERMISSIONS`: `scan`, `override_qc`, `approve_rejected`, `bypass_sequence`, `manage_stock`, `create_containers`, `view_reports`, `manage_employees`.
  - **Station scoping:** `profiles.allowed_stations` (`workflow_stage[]`) limits which stations an operator may scan; supervisors (admin, chef) bypass.
- **Session shape** (`SessionUser`): `{ userId, email, profile }` where profile = `id, full_name, employee_code, role, line_id, station, allowed_stations, permissions, status`.
- **The staff identity for activity is `profiles.id`** (FK from `scan_events.scanned_by`, `*_by` columns, `by_user`). `full_name` + `employee_code` are the display fields.

---

## 3. Schema (Supabase)

16 idempotent migrations in `supabase/migrations/` (`0001`–`0016`). Enums: `app_role`, `user_status`, `workflow_stage` (12 values after `reparation` was inserted), `qc1_status`, `qc2_status`, `reception_status`, `ng_status`, `stock_status`, `check_type`, `rework_kind`, `scan_result`, `entity_type`.

**`workflow_stage`** (the 12-step line): `container_creation` (Scan PCBA) → `otp_validation` → `qc1_box` → `reception` → `serial_linking` (Binding) → `scan_test` (Test) → `ng_handling` (NG) → **`reparation`** → `rescan_reprint` (Reprint) → `carton_printing` (Scan PF) → `qc2_final` (Quality 2) → `stock_entry`.

### Tables (25)

**Identity / config**
- **`profiles`** — `id (uuid PK → auth.users)`, `full_name`, `employee_code (unique)`, `role (app_role)`, `line_id`, `station (workflow_stage)`, `allowed_stations (workflow_stage[])`, `permissions (jsonb)`, `status (user_status)`, `created_at`, `updated_at`. Seeded by `handle_new_user` trigger from auth metadata.
- **`role_settings`** — `role (PK)`, `permissions (jsonb)`, `description`, `updated_at`.
- **`workflow_steps`** — `stage (PK)`, `position (int)`, `enabled (bool)`, `updated_at` (admin on/off + order; all 12 seeded).
- **`app_config`** — singleton (`id = true`): `otp_box_mode`, `otp_box_size`, `carton_size`, `pallet_size`.
- **`production_lines`**, **`models`** — reference tables (line-agnostic since 0007).

**Domain / legacy (0002, largely superseded by pipeline_* tables)**
- **`groups`**, **`containers`**, **`boxes`**, **`pallets`**, **`cartons`**, **`items`**, **`qc_checks`**, **`rework_repairs`**, **`reprints`**.
- **`items`** — the PCBA article created at Scan PCBA: `serial_number (unique)`, `qr_code (unique)`, `current_stage`, `created_by`, `held_by` (added 0016), etc. **`items` is the only legacy table still actively written** (by Scan PCBA `registerArticle` / `recordPcbaPass`).

**Live pipeline (the tables the running flow uses)**
- **`otp_boxes`** (0008/0009/0010) — `box_number`, `box_code`, `mode`, `target`, `product`, `count`, `status ('open'|'closed')`, `qc_state (null|'awaiting'|'conform'|'rework')`, `qc_reason`, `qc_by`, `qc_at`, `current_stage`, `created_by`, `closed_at`.
- **`pipeline_units`** (0011) — the per-carte unit from reception on: `serial (unique)`, `otp_box_id`, `box_code`, `product`, `current_stage`, `status ('active'|'done')`, `test_result`, `problem_reason`, `carton_id` (0012), `held_by` (0016), `updated_at`.
- **`pipeline_cartons`** (0012) — `carton_number`, `code (unique)`, `model`, `count`, `status`, `qc2_state`, `qc2_reason`, `qc2_by`, `qc2_at`, `overridden_by`, `overridden_at`, `pallet_id`, `current_stage`, `stock_entered`, `created_by`, `closed_at`.
- **`pipeline_pallets`** (0012) — `pallet_number`, `code`, `count`, `status`, `stock_entered`, `created_by`, `closed_at`.
- **`carton_movements`** (0012) — take/return of a whole carton at QC2: `carton_id`, `action ('take'|'return')`, `by_user`, `note`, `at`.
- **`unit_movements`** (0016) — take/return of a single product at Scan PF: `unit_id`, `action`, `by_user`, `note`, `at`.
- **`carte_dimo_links`** (0013) — Binding pairs: `carte_code (unique)`, `dimo_code (unique)`, `unit_id`, `created_by`, `created_at`.

**Audit / notifications**
- **`scan_events`** ⭐ — the central immutable audit log: `id`, `stage (workflow_stage)`, `entity_type (entity_type)`, `entity_id`, `code (text)`, `result (scan_result)`, `scanned_by (→ profiles)`, `line_id`, `scanned_at`, `meta (jsonb)`. Indexes on `stage`, `(entity_type, entity_id)`, `scanned_by`, `(line_id, scanned_at)`.
- **`notifications`** — `user_id`, `type`, `box_id`, `title`, `body`, `read`, `created_at`.

### RLS (evolution)

- **`0002`** established **line-scoped** policies (`line_id = my_line()`).
- **`0007` removed line scoping.** Operational tables (`groups, containers, boxes, pallets, cartons, items, qc_checks, rework_repairs, reprints`) are now: **admin = all** (`is_admin()`), and **`select`/`insert`/`update` for any authenticated user** (`auth.uid() is not null`). No `delete` for non-admins.
- **`scan_events`**: `select` = any authenticated; `insert` = **`scanned_by = auth.uid()`** (you may only write your own scans); admin = all. → the RLS-safe client can only insert scan rows attributed to the acting user.
- **`profiles`**: `select` = any authenticated; `insert`/`update`/`delete` = **admin only** (`is_admin()`).
- **`otp_boxes`**: `insert`/`update` restricted to **`created_by = auth.uid()`** (why QC1/reception writes go through the **service-role admin client**).
- **Later tables** (`pipeline_units`, `pipeline_cartons`, `pipeline_pallets`, `carton_movements`, `carte_dimo_links`, `unit_movements`, plus `role_settings`, `workflow_steps`, `app_config`): the same pattern — **admin all; authenticated `select`/`insert`/`update`**; grants to `authenticated, service_role`.
- **Helper fns:** `is_admin()`, `my_role()`, `my_line()`, `registration_open()`, `handle_new_user()`, `touch_updated_at()`, `enforce_pallet_carton_limit()`.
- **Cross-user writes** (e.g. a QC operator advancing another operator's box) use `createAdminClient()` (service role) because RLS restricts non-admin writes to own rows; those writes **still set the actor explicitly** (`scanned_by`/`by_user` = the acting session user), so attribution is preserved.

---

## 4. Existing admin surface

Routes under `src/app/(app)/admin/` (all `requireRole(["admin"])` except `/admin/rejected`, which is gated by `userCan(approve_rejected)`):

| Route | Purpose | Data source |
|---|---|---|
| `/admin` | Overview | `getScanStats` + `getStockStats` |
| `/admin/dashboard` | KPI tiles + charts (`AdminDashboard`) | `getScanStats`, `getStockStats`, `getCartonMovements` |
| `/admin/analytics` | Deeper analytics (`AdminAnalytics`) | `getScanStats` |
| `/admin/stock` | Cartons/pallets + item serials (`AdminStock`) | `getStockInventory` (`src/lib/admin/stock.ts`) |
| `/admin/employees` (+ `/new`, `/[id]`, `/[id]/edit`) | CRUD employees | `profiles` + `saveEmployee`/`deleteEmployee` |
| `/admin/roles` | Per-role permissions editor | `role_settings` |
| `/admin/workflow` | Enable/disable + order the 12 steps | `workflow_steps` |
| `/admin/config` | OTP/carton/pallet sizes + models | `app_config`, `models` |
| `/admin/links` | Carte↔dimo lookup | `carte_dimo_links` |
| `/admin/rejected` | Re-approve rejected cartons | `getRejectedCartons` / `approveRejectedCarton` |

**Aggregation already written** (`src/lib/admin/`):
- **`stats.ts::getScanStats(days=14)`** — pulls `scan_events` for the window + all `profiles`, and computes in-memory: `totalToday`, **`activeToday` (distinct staff today)**, `windowTotal`, `avgGapMin` (avg time between a product's consecutive scans), `daily` series, `perStep`, **`perEmployee` (top-8 scan counts by staff name)**, and `recent` (last 12 with `who`). ← **this is the seed of a staff-activity view.**
- **`stats.ts::getStockStats`** — in-stock units, closed cartons/pallets, stock entries today, recent stocked cartons.
- **`stock.ts::getStockInventory`** — carton/pallet inventory for the stock admin.
- **`chef/waiting.ts::getWaitingByStep`** — per-step "codes waiting" counts (chef supervision).
- **Per-scan log:** `/history` (`requireUser`) reads `scan_events` (`code, stage, result, scanned_at, scanned_by`) + joins `profiles.full_name` for chef/admin; rendered by `ScanHistory.tsx` (date-range + per-stage filters).

---

## 5. Mutating operations (the tracking points)

15 `"use server"` files. **Writes attribute an actor and, for stage transitions, emit a `scan_events` row** — those are the traceability points. Read-only query functions in the same files are omitted here.

**Pipeline stage transitions → write `scan_events` (actor = `scanned_by`):**
- `scan/actions.ts` → **`recordScan`** (generic sequential advance; inserts 1 `scan_events` row; enforces step order unless `bypass_sequence`).
- `scan/sf-actions.ts` → **`registerArticle`** (insert/reuse `items`), **`recordPcbaPass`** (Scan PCBA completion: inserts the origin `container_creation` scan_event, advances `items.current_stage`), `lookupOperator` (read).
- `scan/otp-actions.ts` → **`recordOtpScan`** (delegates to `recordScan` + box accounting on `otp_boxes`), **`closeOtpBox`**, `regenerateLegacyBoxCodes`.
- `scan/qc1-actions.ts` → **`qc1Decision`** (conform → batch `scan_events` + advance box to reception; non-conform → `otp_boxes.qc_state='rework'` + `rework_repairs`).
- `scan/stage-actions.ts` → **`passBox`** (reception: 1 `scan_events` per member + dissolves box into `pipeline_units`).
- `scan/unit-actions.ts` → **`passUnit`, `passTest`, `sendToReparation`, `finishReparation`, `markReprinted`, `reReceiveUnit`, `linkCarteDimo`** — each updates `pipeline_units.current_stage` and writes a `scan_events` audit row (via `auditScan`); `linkCarteDimo` also inserts `carte_dimo_links`.
- `scan/carton-actions.ts` (23 writes — the busiest) → **`recordCartonScan`** (accumulate cartes; auto-close), **`closeCartonManually`** / `closeCartonRow` (advance carton + member units to `qc2_final`), **`qc2Decision`**, **`overrideCartonQc2`**, **`approveRejectedCarton`**, **`stockEntry`**, **`takeUnitOut`/`returnUnit`** (→ `unit_movements` + `pipeline_units.held_by`), **`takeCarton`/`returnCarton`** (→ `carton_movements`).
- `chef/actions.ts` → **`overrideQc`**.

**Admin / config writes (no `scan_events`):**
- `admin/employees/actions.ts` → **`saveEmployee`** (create via auth admin API + patch `profiles`), **`deleteEmployee`**.
- `admin/config/actions.ts` → **`saveConfig`, `addModel`, `deleteModel`**.
- `admin/roles/actions.ts` → **`saveRolePermissions`** (`role_settings`).
- `admin/workflow/actions.ts` → **`saveWorkflowSteps`** (`workflow_steps`).
- `notifications/actions.ts` → **`markRead`, `markAllRead`**.
- `(auth)/actions.ts` → `signIn`, `bootstrapRegister`, `signOut`.

**Movement/quality tables also carry an actor:** `carton_movements.by_user`, `unit_movements.by_user`, `qc_checks.decided_by`/`overridden_by`, `pipeline_cartons.qc2_by`/`overridden_by`, `otp_boxes.qc_by`, `carte_dimo_links.created_by`, `pipeline_units.held_by`.

---

## 6. What "production traceability" records today

The system is built around **`scan_events` as the single immutable, append-only audit log**: one row per scan/transition = **who** (`scanned_by` → profile), **what** (`code` = product/box/carton serial, `entity_type`), **which step** (`stage`), **outcome** (`result`), **when** (`scanned_at`), plus **`meta` jsonb** (e.g. `{ serial, creator, qc }` at PCBA, `{ dimo }` at Binding, `{ otp_box_id }` for box members). It's queryable per stage, per entity, and per staff (`idx_scan_events_scanned` on `scanned_by`).

Complementary records: **per-product/carton custody** (`unit_movements`, `carton_movements` — take/return with `by_user`), **quality decisions** (`qc_checks`, `otp_boxes.qc_*`, `pipeline_cartons.qc2_*` with `*_by`/`overridden_by`), **defects/rework** (`rework_repairs`, `pipeline_units.problem_reason`), and the **carte↔dimo** pairing.

**What it does NOT record:** no login/logout or shift/session events; no explicit "time on station"; no per-scan duration (only inferred `avgGapMin` per product across consecutive scans); movements/quality tables are **not** unified into `scan_events`, so a full "everything a person did" timeline requires joining several sources.

---

## 7. What's missing for a staff-activity admin dashboard

The **foundations exist** — every meaningful action already stamps an actor, and `getScanStats` already computes `activeToday`, `perEmployee`, and a `recent` who/what/when feed. To turn that into a real staff-activity dashboard, the gaps are:

1. **A dedicated route/page** — there's no `/admin/staff` (or similar). Staff data is only a top-8 tile buried in `/admin/dashboard` and `/admin/analytics`.
2. **Per-staff drill-down** — no per-employee page: their activity over time, scans by stage, throughput (units/hr), quality signals (NG/`fail`/`non_conform`/`rejected` counts they produced or handled), rework/repair actions, take/return custody events. Requires unioning `scan_events` with `qc_checks` / `unit_movements` / `carton_movements` (all keyed to a profile id).
3. **Filters** — no date-range / employee / station / role / line filters on aggregates (`getScanStats` is a fixed rolling window, top-8 only, all staff).
4. **Server aggregation** — current stats are computed **in app memory** after pulling all rows for the window (fine at small scale; won't hold at volume). No SQL `group by` / RPC / materialized view for per-staff-per-day-per-stage counts, and no index tuned for `(scanned_by, scanned_at, stage)`.
5. **Unified activity feed** — quality decisions and custody moves live outside `scan_events`, so a complete per-person timeline isn't one query today.
6. **"Active time" / presence** — no session, login, or shift signal, so "hours worked" / "idle time" can't be derived (only crude gaps between scans).
7. **Access control** — a new surface needs a gate: `requireRole(["admin"])` and/or a `view_reports` permission (already in `PERMISSIONS`, not yet enforced anywhere).
8. **Testing** — only the Playwright responsive suite exists; a new admin page would ship with no data-layer tests (no unit-test runner is set up).

---

## 8. Decisions I need from you

1. **Metrics & definition of "activity."** Which matter most: raw scan **throughput** (units/hr, totals by stage), **quality** (NG/reject/rework rates attributable to a person), **custody** (take/return counts), **presence/active-time**, or a mix? (Presence would need a new concept — see #6.)
2. **"Staff" scope.** All authenticated users, or operators + chefs only (exclude admins)? Count supervisors' override actions as activity?
3. **Attribution rule at cross-user steps.** e.g. a QC operator advancing another operator's box: the `scan_events.scanned_by` is the **QC operator**. Is that the correct owner of that activity, or do you want the *original* producer credited too?
4. **Time window & timezone.** Default range (today / 7d / 14d / 30d / custom), and which timezone defines "today" (currently server-local via `setHours(0,0,0,0)`).
5. **Performance posture.** Are you at a scale where in-memory aggregation is fine, or should I add a Postgres **RPC / materialized view** (and an index like `(scanned_by, scanned_at)`)? This is a schema change (`supabase/migrations/`) — confirm that's in scope.
6. **Unify the feed?** Should quality decisions (`qc_checks`) and custody moves (`unit_movements`/`carton_movements`) be surfaced in the staff timeline (join at read time), or is `scan_events` alone sufficient for v1?
7. **Access gate.** Admin-only, or admin + anyone with the `view_reports` permission (which exists but is currently unenforced)?
8. **Surface shape.** A single `/admin/staff` overview + per-employee detail pages, a section added to the existing `/admin/dashboard`, or export (CSV) as well?

_No application code was modified; this file (`docs/audit.md`) is the only change._
