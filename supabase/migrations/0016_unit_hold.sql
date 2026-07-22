-- ============================================================================
-- 0016_unit_hold.sql
-- Scan PF "take a product out / return it" flow. A product waiting to be
-- cartoned can be temporarily taken out by an operator (held) — it leaves the
-- cartoning pool until it is scanned back in. `held_by` is the current holder;
-- `unit_movements` is the audit trail. Run AFTER 0015. Idempotent.
-- Schema/RLS modeled on carton_movements (0012).
-- ============================================================================

-- Current holder of a waiting product (null = available to be cartoned).
alter table public.pipeline_units
  add column if not exists held_by uuid references public.profiles (id);
create index if not exists idx_pipeline_units_held on public.pipeline_units (held_by);

-- Take / return audit trail (one row per take or return).
create table if not exists public.unit_movements (
  id       uuid primary key default gen_random_uuid(),
  unit_id  uuid references public.pipeline_units (id) on delete cascade,
  action   text not null,                       -- 'take' | 'return'
  by_user  uuid references public.profiles (id),
  note     text,
  at       timestamptz not null default now()
);
create index if not exists idx_unit_movements_unit on public.unit_movements (unit_id, at);

-- RLS: admin all; any authenticated user reads; authenticated inserts.
alter table public.unit_movements enable row level security;

drop policy if exists unit_movements_admin on public.unit_movements;
create policy unit_movements_admin on public.unit_movements
  for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists unit_movements_select on public.unit_movements;
create policy unit_movements_select on public.unit_movements
  for select using (auth.uid() is not null);

drop policy if exists unit_movements_insert on public.unit_movements;
create policy unit_movements_insert on public.unit_movements
  for insert with check (auth.uid() is not null);

grant all on public.unit_movements to authenticated, service_role;
