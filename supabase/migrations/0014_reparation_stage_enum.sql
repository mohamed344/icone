-- ============================================================================
-- 0014_reparation_stage_enum.sql
-- Adds the new 'reparation' workflow stage (between ng_handling and
-- rescan_reprint). Flow: Test → NG (register problem) → Reparation (fix) → Test.
--
-- IMPORTANT: this migration ONLY adds the enum value. Postgres forbids USING a
-- newly added enum value in the same transaction that added it (the enum type
-- pre-exists), so the workflow_steps seed lives in 0015 — run this file first,
-- let it commit, THEN run 0015. Idempotent.
-- ============================================================================

alter type public.workflow_stage add value if not exists 'reparation' after 'ng_handling';
