# Icon — Supabase database

Schema for the **Production Traceability & Quality Control** system: employees
(operator / chef de ligne / admin), the 11-step workflow, and a central
`scan_events` audit log that powers traceability and time-between-scans reporting.

> These files are written to run by hand in the **Supabase SQL editor** of your
> existing project (the one in `.env.local`). The MCP connection could not reach
> that project, so nothing was auto-applied.

## How to apply

In the Supabase dashboard → **SQL Editor**, run the files **in order**:

1. `migrations/0001_auth_profiles.sql` — enums, `profiles`, bootstrap-admin trigger, RLS helpers
2. `migrations/0002_production_schema.sql` — all domain tables + `scan_events` + RLS
3. `migrations/0003_views_reporting.sql` — reporting views
4. `migrations/0004_permissions.sql` — per-employee `allowed_stations` (+ legacy `permissions` column)
5. `migrations/0005_role_settings.sql` — per-role permissions (managed at /admin/roles)
6. `migrations/0006_workflow_steps.sql` — the 11 ordered steps + on/off flag (managed at /admin/workflow)
7. `migrations/0007_remove_line_scoping.sql` — access by role + station (no line)
8. `migrations/0008_otp_boxes.sql` — OTP box config + boxes (managed at /admin/config)
9. `migrations/0009_qc1_notifications.sql` — QC#1 box lifecycle + notifications + Realtime
10. `migrations/0010_reception_stage.sql` — box `current_stage` hand-off (reception → …)
11. `migrations/0011_pipeline_units.sql` — per-product tracking for steps 5–11
12. `seed.sql` — *(optional)* two demo lines + two demo models

> Already applied earlier ones? Just run the new files in order (`0004` → `0011`).

### Realtime (for QC#1 notifications)
`0009` tries to add `notifications` and `otp_boxes` to the `supabase_realtime` publication.
If your project doesn't have that publication (or the migration logs a notice), enable
Realtime manually: Supabase dashboard → **Database → Replication → supabase_realtime**,
and toggle on `notifications` (and optionally `otp_boxes`). RLS restricts each user to
their own notifications, so the live channel only delivers rows addressed to them.

Each file is idempotent enough to re-run safely.

## Auth settings

- **Email confirmations:** for the admin-managed flow, employees are created
  server-side with `email_confirm: true`, so confirmation is auto-handled.
  For the very first **bootstrap admin** who self-registers, either disable
  "Confirm email" (Auth → Providers → Email) or confirm that one account.

## Bootstrap the first admin

There is no seeded user. The **first account to sign up becomes `admin` / `active`**
automatically (see `handle_new_user()`), and the public register page then closes.
Every later employee is created by an admin from the in-app admin console.

## Environment variables (`.env.local`)

```
NEXT_PUBLIC_SUPABASE_URL=...              # already set
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=...  # already set
SUPABASE_SERVICE_ROLE_KEY=...             # ADD THIS — Settings → API → service_role (secret)
```

The service-role key is **server-only** (used by `src/lib/supabase/admin.ts` to
create employee accounts). Never expose it to the browser.

## Roles & access (RLS summary)

- **operator** — reads/inserts rows on their own line; one scan station.
- **chef_de_ligne** — same as operator on their line **plus** can override QC#2
  decisions (`qc_checks.overridden_by`).
- **admin** — full access; manages employees, lines, and models.

Helper functions `public.my_role()`, `public.my_line()`, `public.is_admin()`
back every policy (SECURITY DEFINER, so no RLS recursion).

## Tables

`profiles`, `production_lines`, `models`, `groups`, `containers`, `boxes`,
`pallets`, `cartons` (35 per pallet, enforced), `items` (the traced unit),
`qc_checks`, `rework_repairs`, `reprints`, `scan_events` (audit log).

Views: `v_stage_durations`, `v_line_throughput`, `v_qc_summary`.
