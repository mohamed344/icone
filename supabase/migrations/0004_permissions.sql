-- ============================================================================
-- 0004_permissions.sql
-- Per-employee access control set by the admin:
--   allowed_stations — which workflow stations this employee may see/scan
--                      (empty = role default: operator→their station, others→all)
--   permissions      — capability flags, e.g. {"override_qc": true}
-- Run AFTER 0001-0003. Idempotent.
-- ============================================================================

alter table public.profiles
  add column if not exists allowed_stations public.workflow_stage[] not null default '{}',
  add column if not exists permissions jsonb not null default '{}'::jsonb;

comment on column public.profiles.allowed_stations is
  'Stations this employee may access. Empty = role default (operator: their station; chef/admin: all).';
comment on column public.profiles.permissions is
  'Capability flags granted by the admin, e.g. {"scan":true,"override_qc":true}.';
