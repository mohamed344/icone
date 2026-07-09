-- ============================================================================
-- 0006_workflow_steps.sql
-- The ordered 11-step pipeline. Admin can turn a step OFF; disabled steps are
-- skipped when enforcing that a product advances 1 → 11 without skipping.
-- Run AFTER 0005. Idempotent.
-- ============================================================================

create table if not exists public.workflow_steps (
  stage      public.workflow_stage primary key,
  position   int not null,
  enabled    boolean not null default true,
  updated_at timestamptz not null default now()
);

insert into public.workflow_steps (stage, position) values
  ('container_creation', 1),
  ('otp_validation',     2),
  ('qc1_box',            3),
  ('reception',          4),
  ('serial_linking',     5),
  ('scan_test',          6),
  ('ng_handling',        7),
  ('rescan_reprint',     8),
  ('carton_printing',    9),
  ('qc2_final',          10),
  ('stock_entry',        11)
on conflict (stage) do nothing;

drop trigger if exists trg_workflow_steps_touch on public.workflow_steps;
create trigger trg_workflow_steps_touch
  before update on public.workflow_steps
  for each row execute function public.touch_updated_at();

alter table public.workflow_steps enable row level security;

drop policy if exists workflow_steps_read on public.workflow_steps;
create policy workflow_steps_read on public.workflow_steps
  for select using (auth.uid() is not null);

drop policy if exists workflow_steps_admin on public.workflow_steps;
create policy workflow_steps_admin on public.workflow_steps
  for all using (public.is_admin()) with check (public.is_admin());

grant select, insert, update on public.workflow_steps to authenticated, service_role;
