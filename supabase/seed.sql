-- ============================================================================
-- seed.sql — optional demo reference data (no users; the first sign-up becomes
-- the admin automatically). Safe to run multiple times. Run AFTER 0001-0003.
-- ============================================================================

insert into public.production_lines (code, name) values
  ('LINE-A', 'Assembly Line A'),
  ('LINE-B', 'Assembly Line B')
on conflict (code) do nothing;

insert into public.models (reference, name) values
  ('MDL-1000', 'Model 1000'),
  ('MDL-2000', 'Model 2000')
on conflict (reference) do nothing;
