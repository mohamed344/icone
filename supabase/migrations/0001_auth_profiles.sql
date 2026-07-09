-- ============================================================================
-- 0001_auth_profiles.sql
-- Icon — Production Traceability & Quality Control
-- Auth roles, employee profiles, bootstrap-first-admin trigger, RLS helpers.
-- Run this FIRST in the Supabase SQL editor.
-- ============================================================================

-- ---------- Shared enums ----------------------------------------------------
do $$ begin
  create type public.app_role as enum ('operator', 'chef_de_ligne', 'admin');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.user_status as enum ('active', 'pending', 'disabled');
exception when duplicate_object then null; end $$;

-- The 11 workflow stages from the specification (used by profiles.station,
-- items.current_stage and scan_events.stage).
do $$ begin
  create type public.workflow_stage as enum (
    'container_creation',  -- 1  Scan & Container Creation
    'otp_validation',      -- 2  OTP Validation
    'qc1_box',             -- 3  Quality Check #1 (box level)
    'reception',           -- 4  Reception
    'serial_linking',      -- 5  Serial Number Linking
    'scan_test',           -- 6  Scan Functionality Test
    'ng_handling',         -- 7  NG (No-Good) Handling
    'rescan_reprint',      -- 8  Box Code Re-Scan & Reprint
    'carton_printing',     -- 9  Box / Carton Printing
    'qc2_final',           -- 10 Quality Check #2 (final decision)
    'stock_entry'          -- 11 Stock Entry
  );
exception when duplicate_object then null; end $$;

-- ---------- profiles (1:1 with auth.users) ----------------------------------
create table if not exists public.profiles (
  id            uuid primary key references auth.users (id) on delete cascade,
  full_name     text,
  employee_code text unique,
  role          public.app_role   not null default 'operator',
  line_id       uuid,                       -- FK added in 0002 (after production_lines)
  station       public.workflow_stage,      -- operator's assigned step
  status        public.user_status not null default 'pending',
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

comment on table public.profiles is 'Employee profile, one row per auth user. Role + line + station drive access.';

-- ---------- generic updated_at touch ----------------------------------------
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end $$;

drop trigger if exists trg_profiles_touch on public.profiles;
create trigger trg_profiles_touch
  before update on public.profiles
  for each row execute function public.touch_updated_at();

-- ---------- RLS helper functions (SECURITY DEFINER → bypass RLS, no recursion)
create or replace function public.my_role()
returns public.app_role
language sql stable security definer set search_path = public as $$
  select role from public.profiles where id = auth.uid()
$$;

create or replace function public.my_line()
returns uuid
language sql stable security definer set search_path = public as $$
  select line_id from public.profiles where id = auth.uid()
$$;

create or replace function public.is_admin()
returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
$$;

-- True only while NO account exists yet → the public register page (bootstrap
-- first admin) is open. Callable by anon so the login/register UI can branch.
create or replace function public.registration_open()
returns boolean
language sql stable security definer set search_path = public as $$
  select not exists (select 1 from public.profiles)
$$;

-- ---------- bootstrap-first-admin + new-user provisioning -------------------
-- The very FIRST account becomes admin/active. Every later account reads its
-- role/line/station/full_name from auth metadata set by the admin create flow.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_existing int;
  v_role     public.app_role;
  v_status   public.user_status;
begin
  select count(*) into v_existing from public.profiles;

  if v_existing = 0 then
    v_role   := 'admin';
    v_status := 'active';
  else
    v_role   := coalesce(nullif(new.raw_user_meta_data ->> 'role', '')::public.app_role, 'operator');
    v_status := coalesce(nullif(new.raw_user_meta_data ->> 'status', '')::public.user_status, 'pending');
  end if;

  insert into public.profiles (id, full_name, employee_code, role, line_id, station, status)
  values (
    new.id,
    nullif(new.raw_user_meta_data ->> 'full_name', ''),
    nullif(new.raw_user_meta_data ->> 'employee_code', ''),
    v_role,
    nullif(new.raw_user_meta_data ->> 'line_id', '')::uuid,
    nullif(new.raw_user_meta_data ->> 'station', '')::public.workflow_stage,
    v_status
  );
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------- RLS for profiles ------------------------------------------------
alter table public.profiles enable row level security;

drop policy if exists profiles_select on public.profiles;
create policy profiles_select on public.profiles for select using (
  id = auth.uid()
  or public.is_admin()
  or (public.my_role() = 'chef_de_ligne' and line_id = public.my_line())
);

-- Writes are admin-only (employees are admin-managed). The trigger above runs
-- as SECURITY DEFINER so it inserts profiles regardless of these policies.
drop policy if exists profiles_insert_admin on public.profiles;
create policy profiles_insert_admin on public.profiles for insert with check (public.is_admin());

drop policy if exists profiles_update_admin on public.profiles;
create policy profiles_update_admin on public.profiles for update
  using (public.is_admin()) with check (public.is_admin());

drop policy if exists profiles_delete_admin on public.profiles;
create policy profiles_delete_admin on public.profiles for delete using (public.is_admin());

-- ---------- grants (RLS still gates rows) -----------------------------------
grant usage on schema public to anon, authenticated, service_role;
grant execute on all functions in schema public to anon, authenticated, service_role;
grant select, insert, update, delete on public.profiles to authenticated, service_role;
