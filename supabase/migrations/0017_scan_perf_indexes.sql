-- Scan performance: index the hot lookups on the central audit log.
--
-- Every scan resolves a product's last event with
--   select stage from scan_events where code = $1 order by scanned_at desc limit 1
-- and PCBA completion checks with
--   select id from scan_events where code = $1 and stage = $2 limit 1.
-- `scan_events.code` had no index, so each of these was a full sequential scan
-- of the (unbounded, ever-growing) audit log — the main cause of multi-second
-- scan latency. This turns those into single index seeks.
create index if not exists idx_scan_events_code_time
  on public.scan_events (code, scanned_at desc);

-- getTodayStageScans() reads one operator's scans at one station for today:
--   where scanned_by = $1 and stage = $2 and scanned_at >= $today order by scanned_at desc
-- A composite covering index keeps the station activity log instant as history grows.
create index if not exists idx_scan_events_by_stage_time
  on public.scan_events (scanned_by, stage, scanned_at desc);
