-- ============================================================================
-- 0012_cartons_pallets.sql
-- End-of-line grouping (steps 9-11):
--   * Scan PF (step 9): cartes are accumulated into a CARTON of N (default 40).
--     On completion a carton label is printed (grid of product barcodes + QR).
--   * Qualité 2 (step 10): each carton is approved/rejected (chef can override);
--     employees may TAKE a carton out and RETURN it (audited).
--   * Approved cartons accumulate into a PALLET of M (default 35).
--   * Stock (step 11): receive by pallet OR carton -> products enter stock.
-- Run AFTER 0011. Idempotent.
-- ============================================================================

-- Config: carton + pallet sizes (admin-managed) -------------------------------
alter table public.app_config
  add column if not exists carton_size int not null default 40,
  add column if not exists pallet_size int not null default 35;

-- Pallets (a pallet holds `pallet_size` approved cartons) ---------------------
create table if not exists public.pipeline_pallets (
  id               uuid primary key default gen_random_uuid(),
  pallet_number    int not null,
  code             text unique,
  count            int not null default 0,
  status           text not null default 'open',   -- 'open' | 'closed'
  stock_entered    boolean not null default false,
  stock_entered_at timestamptz,
  created_by       uuid references public.profiles (id),
  created_at       timestamptz not null default now(),
  closed_at        timestamptz
);
create index if not exists idx_pipeline_pallets_status on public.pipeline_pallets (status);

-- Cartons (a carton holds `carton_size` cartes) -------------------------------
create table if not exists public.pipeline_cartons (
  id            uuid primary key default gen_random_uuid(),
  carton_number int not null,
  code          text unique,
  model         text,
  count         int not null default 0,
  status        text not null default 'open',      -- 'open' | 'closed'
  qc2_state     text,                              -- null | 'pending' | 'approved' | 'rejected'
  qc2_reason    text,
  qc2_by        uuid references public.profiles (id),
  qc2_at        timestamptz,
  overridden_by uuid references public.profiles (id),
  overridden_at timestamptz,
  pallet_id     uuid references public.pipeline_pallets (id) on delete set null,
  current_stage public.workflow_stage,
  stock_entered boolean not null default false,
  created_by    uuid references public.profiles (id),
  created_at    timestamptz not null default now(),
  closed_at     timestamptz
);
create index if not exists idx_pipeline_cartons_owner_status on public.pipeline_cartons (created_by, status);
create index if not exists idx_pipeline_cartons_stage on public.pipeline_cartons (current_stage);
create index if not exists idx_pipeline_cartons_pallet on public.pipeline_cartons (pallet_id);

-- Link a carte to its carton --------------------------------------------------
alter table public.pipeline_units
  add column if not exists carton_id uuid references public.pipeline_cartons (id) on delete set null;
create index if not exists idx_pipeline_units_carton on public.pipeline_units (carton_id);

-- Carton take/return audit log ------------------------------------------------
create table if not exists public.carton_movements (
  id         uuid primary key default gen_random_uuid(),
  carton_id  uuid references public.pipeline_cartons (id) on delete cascade,
  action     text not null,                        -- 'take' | 'return'
  by_user    uuid references public.profiles (id),
  note       text,
  at         timestamptz not null default now()
);
create index if not exists idx_carton_movements_carton on public.carton_movements (carton_id, at);

-- Touch trigger for cartons ---------------------------------------------------
-- (pipeline_pallets/carton_movements are append-or-set-once; no updated_at.)

-- RLS: any authenticated user reads; inserts/updates by any authenticated user
-- (station enforcement lives in the app, mirroring 0011). ---------------------
do $$
declare t text;
begin
  foreach t in array array['pipeline_pallets', 'pipeline_cartons', 'carton_movements'] loop
    execute format('alter table public.%I enable row level security;', t);

    execute format('drop policy if exists %I on public.%I;', t || '_admin', t);
    execute format('create policy %I on public.%I for all using (public.is_admin()) with check (public.is_admin());', t || '_admin', t);

    execute format('drop policy if exists %I on public.%I;', t || '_select', t);
    execute format('create policy %I on public.%I for select using (auth.uid() is not null);', t || '_select', t);

    execute format('drop policy if exists %I on public.%I;', t || '_insert', t);
    execute format('create policy %I on public.%I for insert with check (auth.uid() is not null);', t || '_insert', t);

    execute format('drop policy if exists %I on public.%I;', t || '_update', t);
    execute format('create policy %I on public.%I for update using (auth.uid() is not null) with check (auth.uid() is not null);', t || '_update', t);
  end loop;
end $$;

grant select, insert, update on public.pipeline_pallets  to authenticated, service_role;
grant select, insert, update on public.pipeline_cartons  to authenticated, service_role;
grant select, insert, update on public.carton_movements  to authenticated, service_role;
