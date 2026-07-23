-- ============================================================================
-- 0019_waiting_overview_rpc.sql
-- The chef overview ("codes waiting at each step") in one database round-trip.
--
-- getWaitingByStep() used to pull the full container_creation and otp_validation
-- scan_events history (up to 20k rows each) plus all carte_dimo_links, then
-- computed the set differences in Node. Those logs only grow, so the payload —
-- and the /chef page — got slower over time (~1.1s). This function does the set
-- math in Postgres and returns only the small waiting sets + exact counts, so
-- the client transfers a few hundred codes instead of tens of thousands.
--
-- SECURITY INVOKER: the caller's RLS applies (all these tables are readable by
-- authenticated users). Mirrors src/lib/chef/waiting.ts exactly. Run AFTER 0018.
-- ============================================================================

create or replace function public.waiting_overview(p_cap int default 200)
returns jsonb
language sql
stable
security invoker
set search_path = public
as $$
with
  -- Step 1: scanned at container_creation but not yet at otp_validation.
  cc_waiting as (
    select code from public.scan_events where stage = 'container_creation'
    except
    select code from public.scan_events where stage = 'otp_validation'
  ),
  -- Step 2: items scanned at OTP whose box is still open (not sent to QC#1).
  open_boxes as (
    select id from public.otp_boxes where status = 'open'
  ),
  otp_waiting as (
    select distinct e.code
    from public.scan_events e
    where e.stage = 'otp_validation'
      and (e.meta ->> 'otp_box_id') is not null
      and (e.meta ->> 'otp_box_id')::uuid in (select id from open_boxes)
  ),
  -- Step 3 / 4: box codes at QC#1 / reception.
  qc1_boxes as (
    select coalesce(box_code, '#' || box_number) as code
    from public.otp_boxes where qc_state in ('awaiting', 'rework')
  ),
  reception_boxes as (
    select coalesce(box_code, '#' || box_number) as code
    from public.otp_boxes where current_stage = 'reception'
  ),
  -- Steps 5-10: individually-tracked cartes by their current stage. From Test
  -- onward the product is shown by its dimo barcode (its physical label); the
  -- serial_linking step keeps the raw serial.
  unit_codes as (
    select
      u.current_stage as stage,
      case when u.current_stage = 'serial_linking'
           then u.serial
           else coalesce(l.dimo_code, u.serial)
      end as code
    from public.pipeline_units u
    left join public.carte_dimo_links l on l.carte_code = u.serial
    where u.status = 'active'
      and u.current_stage = any (array[
        'serial_linking','scan_test','ng_handling','reparation',
        'rescan_reprint','carton_printing']::public.workflow_stage[])
  ),
  -- Steps 10 (QC#2) / 11 (stock): carton codes.
  qc2_cartons as (
    select coalesce(code, '#' || carton_number) as code
    from public.pipeline_cartons where current_stage = 'qc2_final' and qc2_state = 'pending'
  ),
  stock_cartons as (
    select coalesce(code, '#' || carton_number) as code
    from public.pipeline_cartons where current_stage = 'stock_entry' and stock_entered = false
  ),
  -- All waiting codes tagged with their step.
  all_waiting as (
    select 'container_creation'::text as stage, code from cc_waiting
    union all select 'otp_validation', code from otp_waiting
    union all select 'qc1_box',        code from qc1_boxes
    union all select 'reception',      code from reception_boxes
    union all select uc.stage::text,   uc.code from unit_codes uc
    union all select 'qc2_final',      code from qc2_cartons
    union all select 'stock_entry',    code from stock_cartons
  ),
  agg as (
    select stage, count(*)::int as cnt, (array_agg(code))[1:p_cap] as codes
    from all_waiting group by stage
  )
select coalesce(jsonb_agg(
         jsonb_build_object(
           'stage',  s.stage,
           'entity', s.entity,
           'count',  coalesce(a.cnt, 0),
           'codes',  coalesce(to_jsonb(a.codes), '[]'::jsonb)
         ) order by s.ord), '[]'::jsonb)
  from (values
    ('container_creation', 'item',   1),
    ('otp_validation',     'item',   2),
    ('qc1_box',            'box',    3),
    ('reception',          'box',    4),
    ('serial_linking',     'item',   5),
    ('scan_test',          'item',   6),
    ('ng_handling',        'item',   7),
    ('reparation',         'item',   8),
    ('rescan_reprint',     'item',   9),
    ('carton_printing',    'item',  10),
    ('qc2_final',          'carton',11),
    ('stock_entry',        'carton',12)
  ) as s(stage, entity, ord)
  left join agg a on a.stage = s.stage;
$$;

grant execute on function public.waiting_overview(int) to authenticated;
