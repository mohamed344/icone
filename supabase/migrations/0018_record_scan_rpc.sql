-- ============================================================================
-- 0018_record_scan_rpc.sql
-- Collapse a scan into ONE database round-trip.
--
-- recordScan() previously made ~4 sequential network round-trips per scan
-- (profile -> role permissions -> workflow steps -> last event -> insert).
-- When the DB region is far from the operator each hop costs 300-700ms, so the
-- spinner ran for seconds. This function performs the whole thing server-side
-- where every read is a local index lookup, so the client pays a single hop.
--
-- It is SECURITY INVOKER: existing RLS still applies (own profile, readable
-- role_settings/workflow_steps/scan_events, and the self-insert check on
-- scan_events). It mirrors the TypeScript logic in src/app/(app)/scan/actions.ts
-- and src/lib/scan/guard.ts exactly, including error strings and reasons.
-- Run AFTER 0017. Idempotent.
-- ============================================================================

create or replace function public.record_scan(
  p_stage       public.workflow_stage,
  p_code        text,
  p_entity_type public.entity_type,
  p_result      public.scan_result default 'ok',
  p_meta        jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_uid        uuid := auth.uid();
  v_code       text := btrim(p_code);
  v_role       public.app_role;
  v_allowed    public.workflow_stage[];
  v_perms      jsonb;
  v_is_super   boolean;
  v_can_scan   boolean;
  v_can_bypass boolean;
  -- Canonical order, mirroring WORKFLOW_STAGES in src/lib/workflow.ts. The
  -- workflow_steps table only supplies the enabled flag (and may omit a stage,
  -- which the app treats as disabled) — ordering must come from this list.
  v_stages     public.workflow_stage[] := array[
    'container_creation','otp_validation','qc1_box','reception','serial_linking',
    'scan_test','ng_handling','reparation','rescan_reprint','carton_printing',
    'qc2_final','stock_entry']::public.workflow_stage[];
  v_enabled    public.workflow_stage[];
  v_last       public.workflow_stage;
  v_expected   public.workflow_stage;
  v_next       public.workflow_stage;
  v_id         uuid;
  v_at         timestamptz;
  i            int;
begin
  if v_uid is null then
    return jsonb_build_object('error', 'Not authenticated.');
  end if;
  if v_code is null or v_code = '' then
    return jsonb_build_object('error', 'Empty code.');
  end if;

  select role, coalesce(allowed_stations, '{}')
    into v_role, v_allowed
    from public.profiles
   where id = v_uid;
  if v_role is null then
    return jsonb_build_object('error', 'Not authenticated.');
  end if;

  v_is_super := v_role in ('admin', 'chef_de_ligne');

  -- Role-level permissions, mirroring roleCan()/getRolePermissions() with the
  -- defaultPermissions() fallback when no role_settings row exists.
  select permissions into v_perms from public.role_settings where role = v_role;
  if v_perms is null then
    v_perms := case v_role
      when 'admin' then '{"scan":true,"override_qc":true,"approve_rejected":true,"bypass_sequence":true,"manage_stock":true,"create_containers":true,"view_reports":true,"manage_employees":true}'::jsonb
      when 'chef_de_ligne' then '{"scan":true,"override_qc":true,"manage_stock":true,"view_reports":true}'::jsonb
      else '{"scan":true}'::jsonb
    end;
  end if;
  v_can_scan   := (v_role = 'admin') or coalesce((v_perms->>'scan')::boolean, false);
  v_can_bypass := (v_role = 'admin') or coalesce((v_perms->>'bypass_sequence')::boolean, false);

  if not v_can_scan then
    return jsonb_build_object('error', 'Your role doesn''t have permission to scan.');
  end if;

  -- Supervisors act at any station; everyone else needs the stage assigned.
  if not v_is_super then
    if array_length(v_allowed, 1) is null then
      return jsonb_build_object('error', 'No station assigned to your account. Ask an admin.');
    end if;
    if not (p_stage = any(v_allowed)) then
      return jsonb_build_object('error', 'This station is not assigned to you.');
    end if;
  end if;

  -- Enabled stages, mirroring getAllSteps()/getEnabledStages(): if the table is
  -- empty everything is enabled; otherwise a stage is enabled only if it has a
  -- row with enabled = true (a missing stage counts as disabled).
  if exists (select 1 from public.workflow_steps) then
    select coalesce(array_agg(stage), '{}'::public.workflow_stage[])
      into v_enabled
      from public.workflow_steps
     where enabled;
  else
    v_enabled := v_stages;
  end if;

  -- Sequential enforcement (skipped for bypass_sequence / admin).
  if not v_can_bypass then
    if not (p_stage = any(v_enabled)) then
      return jsonb_build_object('reason', 'step_off');
    end if;

    select stage into v_last
      from public.scan_events
     where code = v_code
     order by scanned_at desc
     limit 1;

    -- Expected = first enabled stage after the code's last recorded stage.
    v_expected := null;
    for i in (coalesce(array_position(v_stages, v_last), 0) + 1) .. array_length(v_stages, 1) loop
      if v_stages[i] = any(v_enabled) then
        v_expected := v_stages[i];
        exit;
      end if;
    end loop;

    if v_expected is null then
      return jsonb_build_object('reason', 'completed');
    end if;
    if p_stage <> v_expected then
      return jsonb_build_object(
        'reason', 'out_of_order',
        'expectedStage', v_expected,
        'notStarted', (v_last is null)
      );
    end if;
  end if;

  -- Immutable audit row. RLS enforces scanned_by = auth.uid().
  insert into public.scan_events (stage, entity_type, code, result, scanned_by, meta)
  values (p_stage, p_entity_type, v_code, coalesce(p_result, 'ok'::public.scan_result), v_uid, coalesce(p_meta, '{}'::jsonb))
  returning id, scanned_at into v_id, v_at;

  -- Next enabled stage after the one just scanned (null = finished).
  v_next := null;
  for i in (coalesce(array_position(v_stages, p_stage), 0) + 1) .. array_length(v_stages, 1) loop
    if v_stages[i] = any(v_enabled) then
      v_next := v_stages[i];
      exit;
    end if;
  end loop;

  return jsonb_build_object('ok', true, 'id', v_id, 'at', v_at, 'nextStage', v_next);
end;
$$;

grant execute on function public.record_scan(
  public.workflow_stage, text, public.entity_type, public.scan_result, jsonb
) to authenticated;
