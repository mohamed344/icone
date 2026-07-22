-- ============================================================================
-- 0015_reparation_step_seed.sql
-- Registers 'reparation' in workflow_steps and re-numbers the pipeline so the
-- admin Workflow config lists all 12 steps in order. Run AFTER 0014 has
-- committed (it needs the new enum value). Idempotent.
-- ============================================================================

insert into public.workflow_steps (stage, position, enabled) values
  ('container_creation', 1, true),
  ('otp_validation',     2, true),
  ('qc1_box',            3, true),
  ('reception',          4, true),
  ('serial_linking',     5, true),
  ('scan_test',          6, true),
  ('ng_handling',        7, true),
  ('reparation',         8, true),
  ('rescan_reprint',     9, true),
  ('carton_printing',   10, true),
  ('qc2_final',         11, true),
  ('stock_entry',       12, true)
on conflict (stage) do update set position = excluded.position;
