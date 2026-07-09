-- ============================================================================
-- 0002_production_schema.sql
-- Icon — full 11-step traceability domain + central scan_events audit log.
-- Run AFTER 0001. Every physical entity carries a code/QR; every scan writes
-- one immutable row to scan_events (who/what/when/stage) for full retrace.
-- ============================================================================

-- ---------- domain enums ----------------------------------------------------
do $$ begin create type public.qc1_status       as enum ('conform', 'non_conform'); exception when duplicate_object then null; end $$;
do $$ begin create type public.qc2_status       as enum ('pending', 'approved', 'rejected'); exception when duplicate_object then null; end $$;
do $$ begin create type public.reception_status as enum ('pending', 'received'); exception when duplicate_object then null; end $$;
do $$ begin create type public.ng_status        as enum ('none', 'ng', 'repair'); exception when duplicate_object then null; end $$;
do $$ begin create type public.stock_status     as enum ('none', 'in_stock'); exception when duplicate_object then null; end $$;
do $$ begin create type public.check_type       as enum ('qc1', 'qc2'); exception when duplicate_object then null; end $$;
do $$ begin create type public.rework_kind      as enum ('rework', 'repair', 'ng'); exception when duplicate_object then null; end $$;
do $$ begin create type public.scan_result      as enum ('ok','fail','conform','non_conform','approved','rejected','pending'); exception when duplicate_object then null; end $$;
do $$ begin create type public.entity_type      as enum ('container','box','item','carton','pallet','group'); exception when duplicate_object then null; end $$;

-- ---------- reference tables (line-agnostic) --------------------------------
create table if not exists public.production_lines (
  id            uuid primary key default gen_random_uuid(),
  code          text unique not null,
  name          text not null,
  supervisor_id uuid references public.profiles (id) on delete set null,
  created_at    timestamptz not null default now()
);

create table if not exists public.models (
  id         uuid primary key default gen_random_uuid(),
  reference  text unique not null,
  name       text not null,
  created_at timestamptz not null default now()
);

-- profiles.line_id can now reference production_lines
do $$ begin
  alter table public.profiles
    add constraint profiles_line_id_fkey
    foreign key (line_id) references public.production_lines (id) on delete set null;
exception when duplicate_object then null; end $$;

-- ---------- step 1-2: groups (of 70) & containers ---------------------------
create table if not exists public.groups (
  id               uuid primary key default gen_random_uuid(),
  code             text unique not null,
  line_id          uuid references public.production_lines (id) on delete set null,
  model_id         uuid references public.models (id) on delete set null,
  unit_target      int not null default 70,
  otp_validated    boolean not null default false,
  otp_validated_by uuid references public.profiles (id),
  otp_validated_at timestamptz,
  created_by       uuid references public.profiles (id),
  created_at       timestamptz not null default now()
);

create table if not exists public.containers (
  id           uuid primary key default gen_random_uuid(),
  qr_code      text unique not null,
  model_id     uuid references public.models (id) on delete set null,
  group_id     uuid references public.groups (id) on delete set null,
  line_id      uuid references public.production_lines (id) on delete set null,
  problem      boolean not null default false,
  confirmed_by uuid references public.profiles (id),
  created_by   uuid references public.profiles (id),
  created_at   timestamptz not null default now()
);

-- ---------- step 3 / 8 / 9: boxes -------------------------------------------
create table if not exists public.boxes (
  id            uuid primary key default gen_random_uuid(),
  box_code      text unique not null,
  group_id      uuid references public.groups (id) on delete set null,
  line_id       uuid references public.production_lines (id) on delete set null,
  qc1_status    public.qc1_status,
  justification text,
  printed       boolean not null default false,
  created_by    uuid references public.profiles (id),
  created_at    timestamptz not null default now()
);

-- ---------- step 9 / 11: pallets & cartons (35 cartons = 1 pallet) ----------
create table if not exists public.pallets (
  id               uuid primary key default gen_random_uuid(),
  pallet_code      text unique not null,
  line_id          uuid references public.production_lines (id) on delete set null,
  stock_entered    boolean not null default false,
  stock_entered_at timestamptz,
  created_by       uuid references public.profiles (id),
  created_at       timestamptz not null default now()
);

create table if not exists public.cartons (
  id          uuid primary key default gen_random_uuid(),
  carton_code text unique not null,
  pallet_id   uuid references public.pallets (id) on delete set null,
  line_id     uuid references public.production_lines (id) on delete set null,
  printed     boolean not null default false,
  created_by  uuid references public.profiles (id),
  created_at  timestamptz not null default now()
);

create or replace function public.enforce_pallet_carton_limit()
returns trigger language plpgsql as $$
begin
  if new.pallet_id is not null
     and (select count(*) from public.cartons
          where pallet_id = new.pallet_id and id <> new.id) >= 35 then
    raise exception 'Pallet % already holds 35 cartons (one pallet = 35 cartons).', new.pallet_id;
  end if;
  return new;
end $$;

drop trigger if exists trg_pallet_carton_limit on public.cartons;
create trigger trg_pallet_carton_limit
  before insert or update on public.cartons
  for each row execute function public.enforce_pallet_carton_limit();

-- ---------- the traced unit -------------------------------------------------
create table if not exists public.items (
  id               uuid primary key default gen_random_uuid(),
  serial_number    text unique,
  qr_code          text unique not null,
  container_id     uuid references public.containers (id) on delete set null,
  box_id           uuid references public.boxes (id) on delete set null,
  carton_id        uuid references public.cartons (id) on delete set null,
  line_id          uuid references public.production_lines (id) on delete set null,
  model_id         uuid references public.models (id) on delete set null,
  current_stage    public.workflow_stage   not null default 'container_creation',
  reception_status public.reception_status not null default 'pending',
  scan_functional  boolean,
  ng_status        public.ng_status        not null default 'none',
  qc2_status       public.qc2_status       not null default 'pending',
  rejection_reason text,
  stock_status     public.stock_status     not null default 'none',
  created_by       uuid references public.profiles (id),
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

drop trigger if exists trg_items_touch on public.items;
create trigger trg_items_touch
  before update on public.items
  for each row execute function public.touch_updated_at();

-- ---------- step 3 / 10: quality checks (with chef override) ----------------
create table if not exists public.qc_checks (
  id              uuid primary key default gen_random_uuid(),
  check_type      public.check_type not null,
  item_id         uuid references public.items (id) on delete cascade,
  box_id          uuid references public.boxes (id) on delete cascade,
  decision        public.scan_result not null,   -- conform/non_conform (qc1) | approved/rejected (qc2)
  reason          text,
  decided_by      uuid references public.profiles (id),
  overridden_by   uuid references public.profiles (id),   -- chef de ligne
  overridden_at   timestamptz,
  override_reason text,
  line_id         uuid references public.production_lines (id) on delete set null,
  decided_at      timestamptz not null default now()
);

-- ---------- step 3 / 7: rework, repair, NG ----------------------------------
create table if not exists public.rework_repairs (
  id          uuid primary key default gen_random_uuid(),
  item_id     uuid references public.items (id) on delete cascade,
  box_id      uuid references public.boxes (id) on delete set null,
  kind        public.rework_kind not null,
  reason      text,
  status      text not null default 'open',   -- open | resolved
  line_id     uuid references public.production_lines (id) on delete set null,
  created_by  uuid references public.profiles (id),
  resolved_by uuid references public.profiles (id),
  created_at  timestamptz not null default now(),
  resolved_at timestamptz
);

-- ---------- step 8: reprints (reprinted code must match original) -----------
create table if not exists public.reprints (
  id             uuid primary key default gen_random_uuid(),
  box_code       text not null,
  original_scan  text,
  reprinted_code text,
  matched        boolean not null default false,
  line_id        uuid references public.production_lines (id) on delete set null,
  created_by     uuid references public.profiles (id),
  created_at     timestamptz not null default now()
);

-- ---------- central audit log: every scan = one row -------------------------
create table if not exists public.scan_events (
  id          uuid primary key default gen_random_uuid(),
  stage       public.workflow_stage not null,
  entity_type public.entity_type    not null,
  entity_id   uuid,
  code        text not null,
  result      public.scan_result not null default 'ok',
  scanned_by  uuid references public.profiles (id),
  line_id     uuid references public.production_lines (id) on delete set null,
  scanned_at  timestamptz not null default now(),
  meta        jsonb not null default '{}'::jsonb
);
create index if not exists idx_scan_events_stage     on public.scan_events (stage);
create index if not exists idx_scan_events_entity    on public.scan_events (entity_type, entity_id);
create index if not exists idx_scan_events_scanned   on public.scan_events (scanned_by);
create index if not exists idx_scan_events_line_time on public.scan_events (line_id, scanned_at);

-- ============================================================================
-- RLS
-- Reference tables: any authenticated user reads; admin writes.
-- Line-scoped tables: admin = all; same-line members read/insert/update;
--   scan_events additionally requires scanned_by = self on insert.
-- ============================================================================

-- reference tables
alter table public.production_lines enable row level security;
drop policy if exists lines_read on public.production_lines;
create policy lines_read  on public.production_lines for select using (auth.uid() is not null);
drop policy if exists lines_admin on public.production_lines;
create policy lines_admin on public.production_lines for all using (public.is_admin()) with check (public.is_admin());

alter table public.models enable row level security;
drop policy if exists models_read on public.models;
create policy models_read  on public.models for select using (auth.uid() is not null);
drop policy if exists models_admin on public.models;
create policy models_admin on public.models for all using (public.is_admin()) with check (public.is_admin());

-- line-scoped tables — generated with a helper DO block
do $$
declare t text;
begin
  foreach t in array array[
    'groups','containers','boxes','pallets','cartons','items',
    'qc_checks','rework_repairs','reprints'
  ] loop
    execute format('alter table public.%I enable row level security;', t);

    execute format('drop policy if exists %I on public.%I;', t||'_admin', t);
    execute format('create policy %I on public.%I for all using (public.is_admin()) with check (public.is_admin());', t||'_admin', t);

    execute format('drop policy if exists %I on public.%I;', t||'_line_select', t);
    execute format('create policy %I on public.%I for select using (line_id = public.my_line());', t||'_line_select', t);

    execute format('drop policy if exists %I on public.%I;', t||'_line_insert', t);
    execute format('create policy %I on public.%I for insert with check (line_id = public.my_line());', t||'_line_insert', t);

    execute format('drop policy if exists %I on public.%I;', t||'_line_update', t);
    execute format('create policy %I on public.%I for update using (line_id = public.my_line()) with check (line_id = public.my_line());', t||'_line_update', t);
  end loop;
end $$;

-- scan_events: read own line; insert only your own scans on your line; admin all
alter table public.scan_events enable row level security;
drop policy if exists scan_events_admin on public.scan_events;
create policy scan_events_admin on public.scan_events for all using (public.is_admin()) with check (public.is_admin());
drop policy if exists scan_events_line_select on public.scan_events;
create policy scan_events_line_select on public.scan_events for select using (line_id = public.my_line());
drop policy if exists scan_events_self_insert on public.scan_events;
create policy scan_events_self_insert on public.scan_events for insert
  with check (scanned_by = auth.uid() and line_id = public.my_line());

-- ---------- grants (RLS still gates rows) -----------------------------------
grant all on all tables in schema public to authenticated, service_role;
grant all on all sequences in schema public to authenticated, service_role;
