-- ============================================================================
-- FLOWTYM PMS — Migration 0130 : CSV import mapping templates
-- ----------------------------------------------------------------------------
-- Permet à un hôtel de sauvegarder ses propres mappings CSV (alias colonnes
-- vers les champs canoniques) pour les imports répétés depuis Booking / Expedia
-- / Airbnb / banque.
--
-- Le mapping est un JSONB du type :
--   {
--     "amount":             ["amount", "montant", "total"],
--     "posted_at":          ["date", "payment date"],
--     "external_reference": ["reservation", "booking id"],
--     "description":        ["description", "guest"],
--     "currency":           ["currency", "devise"]
--   }
-- ============================================================================

create table if not exists public.csv_import_templates (
  id uuid primary key default gen_random_uuid(),
  hotel_id uuid not null references public.hotels(id) on delete cascade,
  name text not null,
  source text not null,   -- 'BOOKING' | 'EXPEDIA' | 'AIRBNB' | 'BANK_HOTEL' | custom
  mapping jsonb not null default '{}'::jsonb,
  default_currency text not null default 'EUR',
  is_default boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (hotel_id, name)
);

create index if not exists idx_csv_templates_hotel
  on public.csv_import_templates(hotel_id, source);

alter table public.csv_import_templates enable row level security;
drop policy if exists csv_templates_select on public.csv_import_templates;
drop policy if exists csv_templates_modify on public.csv_import_templates;
create policy csv_templates_select on public.csv_import_templates
  for select to authenticated
  using (hotel_id = public.get_user_hotel_id());
create policy csv_templates_modify on public.csv_import_templates
  for all to authenticated
  using (hotel_id = public.get_user_hotel_id())
  with check (hotel_id = public.get_user_hotel_id());

drop trigger if exists trg_csv_templates_updated_at on public.csv_import_templates;
create trigger trg_csv_templates_updated_at
  before update on public.csv_import_templates
  for each row execute function public.set_updated_at();
