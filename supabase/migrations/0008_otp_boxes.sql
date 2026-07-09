-- ============================================================================
-- 0008_otp_boxes.sql
-- OTP step grouping: scans are gathered into "boxes". A box completes either
-- by COUNT (default 70, admin-configurable) or by PRODUCT (a box holds one
-- product; changing product starts a new box). On completion the box closes
-- and the next one opens automatically.
-- Run AFTER 0007. Idempotent.
-- ============================================================================

-- Singleton app config -------------------------------------------------------
create table if not exists public.app_config (
  id           boolean primary key default true,
  otp_box_mode text not null default 'count',   -- 'count' | 'product'
  otp_box_size int  not null default 70,
  updated_at   timestamptz not null default now(),
  constraint app_config_singleton check (id)
);

insert into public.app_config (id) values (true) on conflict (id) do nothing;

drop trigger if exists trg_app_config_touch on public.app_config;
create trigger trg_app_config_touch
  before update on public.app_config
  for each row execute function public.touch_updated_at();

alter table public.app_config enable row level security;

drop policy if exists app_config_read on public.app_config;
create policy app_config_read on public.app_config
  for select using (auth.uid() is not null);

drop policy if exists app_config_admin on public.app_config;
create policy app_config_admin on public.app_config
  for all using (public.is_admin()) with check (public.is_admin());

grant select, insert, update on public.app_config to authenticated, service_role;

-- OTP boxes ------------------------------------------------------------------
create table if not exists public.otp_boxes (
  id          uuid primary key default gen_random_uuid(),
  box_number  int not null,
  mode        text not null default 'count',
  target      int,                              -- null in product mode
  product     text,
  count       int not null default 0,
  status      text not null default 'open',     -- 'open' | 'closed'
  created_by  uuid references public.profiles (id),
  created_at  timestamptz not null default now(),
  closed_at   timestamptz
);
create index if not exists idx_otp_boxes_owner_status on public.otp_boxes (created_by, status);

alter table public.otp_boxes enable row level security;

drop policy if exists otp_boxes_admin on public.otp_boxes;
create policy otp_boxes_admin on public.otp_boxes
  for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists otp_boxes_select on public.otp_boxes;
create policy otp_boxes_select on public.otp_boxes
  for select using (auth.uid() is not null);

drop policy if exists otp_boxes_insert on public.otp_boxes;
create policy otp_boxes_insert on public.otp_boxes
  for insert with check (created_by = auth.uid());

drop policy if exists otp_boxes_update on public.otp_boxes;
create policy otp_boxes_update on public.otp_boxes
  for update using (created_by = auth.uid()) with check (created_by = auth.uid());

grant select, insert, update on public.otp_boxes to authenticated, service_role;
