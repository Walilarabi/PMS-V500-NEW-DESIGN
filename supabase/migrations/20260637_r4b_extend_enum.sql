-- =============================================================================
-- 20260637_r4b_extend_enum.sql  (R4 — Extension de l'enum admin_user_role)
-- =============================================================================
-- Ajout NON destructif de 3 rôles. breakfast conservé (seul le label UI change).
-- Aucune valeur n'est UTILISÉE dans cette migration (contrainte PostgreSQL :
-- une valeur d'enum ajoutée ne peut être référencée dans la même transaction).
-- Les policies/permissions qui réfèrent ces valeurs sont dans r4c/r4d.
-- =============================================================================
ALTER TYPE public.admin_user_role ADD VALUE IF NOT EXISTS 'admin_hotel';
ALTER TYPE public.admin_user_role ADD VALUE IF NOT EXISTS 'comptabilite';
ALTER TYPE public.admin_user_role ADD VALUE IF NOT EXISTS 'revenue_manager';
-- =============================================================================
-- FIN 20260637_r4b_extend_enum.sql
-- =============================================================================
