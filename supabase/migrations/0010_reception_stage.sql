-- ============================================================================
-- 0010_reception_stage.sql
-- Generic box hand-off across steps 4→11. A conform box gets a `current_stage`
-- pointer (where it waits next); operators at that station scan it to receive
-- and advance it. Reception (step 4) is the first consumer.
-- Run AFTER 0009. Idempotent.
-- ============================================================================

-- Where a box currently waits (null until it enters the post-QC pipeline).
alter table public.otp_boxes
  add column if not exists current_stage public.workflow_stage;

create index if not exists idx_otp_boxes_current_stage on public.otp_boxes (current_stage);

-- Existing conform boxes flow into the reception queue.
update public.otp_boxes
set current_stage = 'reception'
where qc_state = 'conform' and current_stage is null;

-- Notifications can name the stage a box arrived at.
alter table public.notifications
  add column if not exists stage public.workflow_stage;
