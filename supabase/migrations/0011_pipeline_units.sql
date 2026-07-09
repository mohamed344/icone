-- ============================================================================
-- 0011_pipeline_units.sql
-- From step 5 the flow is per individual product. When a conform box is
-- received (step 4), its units are materialized here and travel individually
-- through QR-Scan → Test → (Reprint | NG→Reception loop) → …
-- Run AFTER 0010. Idempotent.
-- ============================================================================

create table if not exists public.pipeline_units (
  id            uuid primary key default gen_random_uuid(),
  serial        text unique not null,
  otp_box_id    uuid references public.otp_boxes (id) on delete set null,
  box_code      text,
  product       text,
  current_stage public.workflow_stage,
  status        text not null default 'active',      -- 'active' | 'done'
  test_result   text,                                -- 'ok' | 'problem'
  problem_reason text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index if not exists idx_pipeline_units_stage on public.pipeline_units (current_stage);
create index if not exists idx_pipeline_units_box on public.pipeline_units (otp_box_id);

drop trigger if exists trg_pipeline_units_touch on public.pipeline_units;
create trigger trg_pipeline_units_touch
  before update on public.pipeline_units
  for each row execute function public.touch_updated_at();

alter table public.pipeline_units enable row level security;

drop policy if exists pipeline_units_admin on public.pipeline_units;
create policy pipeline_units_admin on public.pipeline_units
  for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists pipeline_units_select on public.pipeline_units;
create policy pipeline_units_select on public.pipeline_units
  for select using (auth.uid() is not null);

drop policy if exists pipeline_units_insert on public.pipeline_units;
create policy pipeline_units_insert on public.pipeline_units
  for insert with check (auth.uid() is not null);

drop policy if exists pipeline_units_update on public.pipeline_units;
create policy pipeline_units_update on public.pipeline_units
  for update using (auth.uid() is not null) with check (auth.uid() is not null);

grant select, insert, update on public.pipeline_units to authenticated, service_role;
