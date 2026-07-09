-- ============================================================================
-- 0007_remove_line_scoping.sql
-- Lines are no longer used. Access is by ROLE + allowed stations (poste
-- autorisé), enforced in the app. RLS no longer depends on line_id.
--   - scan_events: any authenticated user may insert their OWN scans; everyone
--     authenticated can read.
--   - other operational tables: authenticated read/insert/update; admin = all.
-- The line_id columns and production_lines table are kept (harmless, unused);
-- drop them later if you wish. Run AFTER 0006. Idempotent.
-- ============================================================================

-- scan_events ---------------------------------------------------------------
drop policy if exists scan_events_line_select on public.scan_events;
drop policy if exists scan_events_self_insert on public.scan_events;

drop policy if exists scan_events_select on public.scan_events;
create policy scan_events_select on public.scan_events
  for select using (auth.uid() is not null);

drop policy if exists scan_events_insert on public.scan_events;
create policy scan_events_insert on public.scan_events
  for insert with check (scanned_by = auth.uid());

-- line-scoped operational tables -> authenticated-based -----------------------
do $$
declare t text;
begin
  foreach t in array array[
    'groups','containers','boxes','pallets','cartons','items',
    'qc_checks','rework_repairs','reprints'
  ] loop
    execute format('drop policy if exists %I on public.%I;', t || '_line_select', t);
    execute format('drop policy if exists %I on public.%I;', t || '_line_insert', t);
    execute format('drop policy if exists %I on public.%I;', t || '_line_update', t);

    execute format('drop policy if exists %I on public.%I;', t || '_auth_select', t);
    execute format('create policy %I on public.%I for select using (auth.uid() is not null);', t || '_auth_select', t);

    execute format('drop policy if exists %I on public.%I;', t || '_auth_insert', t);
    execute format('create policy %I on public.%I for insert with check (auth.uid() is not null);', t || '_auth_insert', t);

    execute format('drop policy if exists %I on public.%I;', t || '_auth_update', t);
    execute format('create policy %I on public.%I for update using (auth.uid() is not null) with check (auth.uid() is not null);', t || '_auth_update', t);
  end loop;
end $$;
