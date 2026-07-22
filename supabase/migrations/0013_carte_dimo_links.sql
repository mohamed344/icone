-- ============================================================================
-- 0013_carte_dimo_links.sql
-- Bending (serial_linking) pairs a flowing carte (unit serial) with a dimo
-- barcode, one-to-one. One immutable row per link, looked up by either code
-- from the admin Links page. Run AFTER 0012. Idempotent.
-- Schema modeled on public.reprints (0002); RLS/grants modeled on 0011.
-- ============================================================================

create table if not exists public.carte_dimo_links (
  id         uuid primary key default gen_random_uuid(),
  carte_code text not null unique,          -- the flowing unit serial (carte)
  dimo_code  text not null unique,          -- the paired dimo barcode (1:1)
  unit_id    uuid references public.pipeline_units (id) on delete set null,
  created_by uuid references public.profiles (id),
  created_at timestamptz not null default now()
);

create index if not exists idx_carte_dimo_links_dimo on public.carte_dimo_links (dimo_code);
create index if not exists idx_carte_dimo_links_unit on public.carte_dimo_links (unit_id);

-- RLS: admin all; any authenticated user reads; authenticated inserts.
alter table public.carte_dimo_links enable row level security;

drop policy if exists carte_dimo_links_admin on public.carte_dimo_links;
create policy carte_dimo_links_admin on public.carte_dimo_links
  for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists carte_dimo_links_select on public.carte_dimo_links;
create policy carte_dimo_links_select on public.carte_dimo_links
  for select using (auth.uid() is not null);

drop policy if exists carte_dimo_links_insert on public.carte_dimo_links;
create policy carte_dimo_links_insert on public.carte_dimo_links
  for insert with check (auth.uid() is not null);

grant all on public.carte_dimo_links to authenticated, service_role;
