-- ============================================================================
-- FLOWTYM PMS — Migration 0140 : Vue FEC (Fichier des Écritures Comptables)
-- ----------------------------------------------------------------------------
-- Norme française obligatoire pour les contrôles fiscaux (article L47 A du LPF).
-- 18 colonnes pipe-délimitées, total débit = total crédit pour chaque écriture.
--
-- Plan comptable utilisé (PCG simplifié hôtellerie) :
--   411xxx  Clients
--   44571   TVA collectée
--   512xxx  Banque (par mode de paiement)
--   530000  Caisse (espèces)
--   707000  Ventes de prestations (Hébergement)
--
-- L'écriture est :
--   • Facture (VE) : Débit 411 (TTC), Crédit 707 (HT), Crédit 44571 (TVA)
--   • Encaissement (BQ) : Débit 512xxx (TTC), Crédit 411 (TTC)
-- ============================================================================

create or replace view public.v_fec_entries as
with payment_account_map as (
  -- Mapping payment_method → CompteNum (compte de trésorerie)
  select 'CB'::text         as method, '512100'::text as compte_num, 'Banque - CB'::text       as compte_lib union all
  select 'CARD',                       '512100',                    'Banque - CB'                  union all
  select 'VIREMENT',                   '512000',                    'Banque - Virement'            union all
  select 'TRANSFER',                   '512000',                    'Banque - Virement'            union all
  select 'CHEQUE',                     '512110',                    'Banque - Chèque'              union all
  select 'CHECK',                      '512110',                    'Banque - Chèque'              union all
  select 'ESPECES',                    '530000',                    'Caisse - Espèces'             union all
  select 'CASH',                       '530000',                    'Caisse - Espèces'             union all
  select 'OTA',                        '512200',                    'Banque - Payout OTA'          union all
  select 'PMS',                        '512300',                    'Banque - PMS'
),
inv as (
  select
    i.id                              as src_id,
    i.hotel_id                        as hotel_id,
    'VE'::text                        as journal_code,
    'Journal des Ventes'::text        as journal_lib,
    i.invoice_number                  as piece_ref,
    coalesce(i.issue_date, i.created_at::date) as ecr_date,
    coalesce(i.issue_date, i.created_at::date) as piece_date,
    coalesce(nullif(i.guest_name, ''), 'Client divers') as guest_name,
    coalesce(i.total_ht, 0)::numeric  as ht,
    coalesce(i.total_tva, 0)::numeric as tva,
    coalesce(i.total_ttc, 0)::numeric as ttc,
    'Facture ' || i.invoice_number || ' - ' || coalesce(i.guest_name, 'Client') as ecr_lib,
    i.reservation_id                  as reservation_id,
    coalesce(i.created_at, now())     as valid_date
  from public.invoices i
  where coalesce(i.status, 'draft') <> 'cancelled'
),
inv_lines as (
  select hotel_id, src_id, journal_code, journal_lib, piece_ref, ecr_date, piece_date, valid_date,
         '411000'::text as compte_num, 'Clients'::text as compte_lib,
         null::text as compaux_num, null::text as compaux_lib,
         ttc as debit, 0::numeric as credit,
         ecr_lib, 1 as sub_order
  from inv
  union all
  select hotel_id, src_id, journal_code, journal_lib, piece_ref, ecr_date, piece_date, valid_date,
         '707000'::text, 'Ventes - Hébergement'::text,
         null::text, null::text,
         0::numeric, ht,
         ecr_lib, 2
  from inv
  where ht > 0
  union all
  select hotel_id, src_id, journal_code, journal_lib, piece_ref, ecr_date, piece_date, valid_date,
         '445710'::text, 'TVA collectée'::text,
         null::text, null::text,
         0::numeric, tva,
         ecr_lib, 3
  from inv
  where tva > 0
),
pay as (
  select
    p.id                              as src_id,
    p.hotel_id                        as hotel_id,
    'BQ'::text                        as journal_code,
    'Journal de Banque'::text         as journal_lib,
    coalesce(p.reference, p.transaction_id, p.id::text) as piece_ref,
    coalesce(p.payment_date::date, p.created_at::date)  as ecr_date,
    coalesce(p.payment_date::date, p.created_at::date)  as piece_date,
    coalesce(p.amount, 0)::numeric    as ttc,
    upper(coalesce(p.payment_method, 'CB')) as method,
    'Encaissement ' || coalesce(p.payment_method, 'CB') || ' - ' || coalesce(p.reference, p.id::text) as ecr_lib,
    coalesce(p.created_at, now())     as valid_date
  from public.payments p
  where coalesce(p.status, 'completed') <> 'cancelled'
),
pay_lines as (
  -- Debit treasury account
  select py.hotel_id, py.src_id, py.journal_code, py.journal_lib, py.piece_ref, py.ecr_date, py.piece_date, py.valid_date,
         coalesce(m.compte_num, '512000')::text as compte_num,
         coalesce(m.compte_lib, 'Banque')::text as compte_lib,
         null::text as compaux_num, null::text as compaux_lib,
         py.ttc as debit, 0::numeric as credit,
         py.ecr_lib, 1 as sub_order
  from pay py
  left join payment_account_map m on m.method = py.method
  union all
  -- Credit client account
  select py.hotel_id, py.src_id, py.journal_code, py.journal_lib, py.piece_ref, py.ecr_date, py.piece_date, py.valid_date,
         '411000'::text, 'Clients'::text,
         null::text, null::text,
         0::numeric, py.ttc,
         py.ecr_lib, 2
  from pay py
),
all_lines as (
  select * from inv_lines
  union all
  select * from pay_lines
),
numbered as (
  select
    hotel_id,
    journal_code,
    journal_lib,
    dense_rank() over (partition by hotel_id, journal_code, date_part('year', ecr_date) order by ecr_date, src_id) as ecr_num,
    ecr_date,
    compte_num,
    compte_lib,
    compaux_num,
    compaux_lib,
    piece_ref,
    piece_date,
    ecr_lib,
    debit,
    credit,
    valid_date,
    src_id,
    sub_order
  from all_lines
)
select
  hotel_id,
  journal_code as "JournalCode",
  journal_lib as "JournalLib",
  -- Numérotation : <journal>-<année>-<numéro>
  journal_code || to_char(ecr_date, 'YYYY') || lpad(ecr_num::text, 6, '0') as "EcritureNum",
  to_char(ecr_date, 'YYYYMMDD') as "EcritureDate",
  compte_num as "CompteNum",
  compte_lib as "CompteLib",
  coalesce(compaux_num, '') as "CompAuxNum",
  coalesce(compaux_lib, '') as "CompAuxLib",
  piece_ref as "PieceRef",
  to_char(piece_date, 'YYYYMMDD') as "PieceDate",
  ecr_lib as "EcritureLib",
  to_char(debit, 'FM999999990D00') as "Debit",
  to_char(credit, 'FM999999990D00') as "Credit",
  ''::text as "EcritureLet",
  ''::text as "DateLet",
  to_char(valid_date, 'YYYYMMDD') as "ValidDate",
  ''::text as "Montantdevise",
  ''::text as "Idevise",
  src_id, sub_order, ecr_num
from numbered;

-- Note: The view is hotel-scoped via downstream RLS application (we filter by hotel_id from caller).
-- Direct access through PostgREST requires either a wrapper SQL function or service-role usage.

comment on view public.v_fec_entries is
  'Vue FEC (Fichier des Écritures Comptables) — agrège invoices+payments en lignes comptables équilibrées. Format pipe-delimited à générer côté backend.';
