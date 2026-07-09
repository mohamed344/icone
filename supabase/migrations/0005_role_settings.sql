-- ============================================================================
-- 0005_role_settings.sql
-- Permissions are managed per ROLE (not per employee). Employees only get a
-- role + allowed_stations; their capabilities come from their role here.
-- Run AFTER 0004. Idempotent.
-- ============================================================================

create table if not exists public.role_settings (
  role        public.app_role primary key,
  permissions jsonb not null default '{}'::jsonb,
  description text,
  updated_at  timestamptz not null default now()
);

insert into public.role_settings (role, permissions, description) values
  ('operator',
   '{"scan": true}'::jsonb,
   'Scans units at an assigned station.'),
  ('chef_de_ligne',
   '{"scan": true, "override_qc": true, "manage_stock": true, "view_reports": true}'::jsonb,
   'Supervises a production line and can override the QC#2 final decision.'),
  ('admin',
   '{"scan": true, "override_qc": true, "manage_stock": true, "create_containers": true, "view_reports": true, "manage_employees": true}'::jsonb,
   'Full access to the whole system.')
on conflict (role) do nothing;

drop trigger if exists trg_role_settings_touch on public.role_settings;
create trigger trg_role_settings_touch
  before update on public.role_settings
  for each row execute function public.touch_updated_at();

alter table public.role_settings enable row level security;

drop policy if exists role_settings_read on public.role_settings;
create policy role_settings_read on public.role_settings
  for select using (auth.uid() is not null);

drop policy if exists role_settings_admin on public.role_settings;
create policy role_settings_admin on public.role_settings
  for all using (public.is_admin()) with check (public.is_admin());

grant select, insert, update on public.role_settings to authenticated, service_role;
