-- ============================================================================
-- 0009_qc1_notifications.sql
-- QC#1 box flow + realtime notifications.
--   * otp_boxes gains a QC lifecycle (box_code + qc_state + decision fields).
--   * notifications table (per-recipient) delivered live via Supabase Realtime.
-- Run AFTER 0008. Idempotent.
-- ============================================================================

-- QC lifecycle on OTP boxes --------------------------------------------------
alter table public.otp_boxes
  add column if not exists box_code  text,
  add column if not exists qc_state  text,          -- null | 'awaiting' | 'conform' | 'rework'
  add column if not exists qc_reason text,
  add column if not exists qc_by     uuid references public.profiles (id),
  add column if not exists qc_at     timestamptz;

create index if not exists idx_otp_boxes_qc_state on public.otp_boxes (qc_state);
create index if not exists idx_otp_boxes_code on public.otp_boxes (box_code);

-- Notifications --------------------------------------------------------------
create table if not exists public.notifications (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.profiles (id) on delete cascade,
  type       text not null,                          -- 'box_ready' | 'box_conform' | 'box_rework'
  box_id     uuid,
  title      text not null,
  body       text,
  read       boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists idx_notifications_user on public.notifications (user_id, read, created_at desc);

alter table public.notifications enable row level security;

drop policy if exists notifications_admin on public.notifications;
create policy notifications_admin on public.notifications
  for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists notifications_own_select on public.notifications;
create policy notifications_own_select on public.notifications
  for select using (user_id = auth.uid());

drop policy if exists notifications_own_update on public.notifications;
create policy notifications_own_update on public.notifications
  for update using (user_id = auth.uid()) with check (user_id = auth.uid());

-- inserts are performed by the service-role client (bypasses RLS)
grant select, insert, update on public.notifications to authenticated, service_role;

-- Realtime: publish notifications + otp_boxes (guard against re-adding) -------
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'notifications'
  ) then
    execute 'alter publication supabase_realtime add table public.notifications';
  end if;

  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'otp_boxes'
  ) then
    execute 'alter publication supabase_realtime add table public.otp_boxes';
  end if;
exception
  when undefined_object then
    -- publication doesn't exist on this project; enable Realtime in the dashboard instead
    raise notice 'supabase_realtime publication not found; enable Realtime on the tables via the dashboard.';
end $$;
