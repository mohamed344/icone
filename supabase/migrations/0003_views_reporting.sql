-- ============================================================================
-- 0003_views_reporting.sql
-- Read-only analytics. Views use security_invoker so they respect the caller's
-- RLS (a chef only sees their line, etc.). Run AFTER 0002. Postgres 15+.
-- ============================================================================

-- Time elapsed between consecutive scans of the same item (performance / SLA).
create or replace view public.v_stage_durations as
select
  e.entity_id                                                              as item_id,
  e.stage,
  e.scanned_at,
  lag(e.scanned_at) over (partition by e.entity_id order by e.scanned_at)  as prev_scanned_at,
  e.scanned_at
    - lag(e.scanned_at) over (partition by e.entity_id order by e.scanned_at) as duration,
  e.line_id
from public.scan_events e
where e.entity_type = 'item';

-- Scans per line / stage / day.
create or replace view public.v_line_throughput as
select
  line_id,
  stage,
  date_trunc('day', scanned_at) as day,
  count(*)                      as scans
from public.scan_events
group by line_id, stage, date_trunc('day', scanned_at);

-- Quality outcome counts (conform/non-conform, approved/rejected).
create or replace view public.v_qc_summary as
select
  line_id,
  check_type,
  decision,
  count(*)                                  as total,
  count(*) filter (where overridden_by is not null) as overridden
from public.qc_checks
group by line_id, check_type, decision;

alter view public.v_stage_durations set (security_invoker = on);
alter view public.v_line_throughput set (security_invoker = on);
alter view public.v_qc_summary      set (security_invoker = on);

grant select on public.v_stage_durations, public.v_line_throughput, public.v_qc_summary
  to authenticated, service_role;
