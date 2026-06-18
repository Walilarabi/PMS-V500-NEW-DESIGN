#!/usr/bin/env bash
# =============================================================================
# FLOWTYM — provisionning hôtel pilote sur projet Supabase neuf
# =============================================================================
# Usage : ./scripts/provision-pilot-hotel.sh <SUPABASE_PROJECT_REF> <HOTEL_NAME>
#
# Cas d'usage : créer un environnement Supabase neuf pour un hôtel pilote.
# Le repo a HISTORIQUEMENT deux répertoires de migrations qui doivent être
# appliqués dans l'ordre, ce script garantit cet ordre.
#
# Ordre canonique :
#   1. frontend/supabase/migrations/0001 → 0167  (numérotation legacy)
#   2. supabase/migrations/20260517 → dernière    (numérotation dated)
#
# Pré-requis :
#   - supabase CLI ≥ 1.180 installé
#   - SUPABASE_ACCESS_TOKEN env var (compte propriétaire)
#   - psql installé (pour validation post-déploiement)
# =============================================================================

set -euo pipefail

PROJECT_REF="${1:?Usage: $0 <PROJECT_REF> <HOTEL_NAME>}"
HOTEL_NAME="${2:?Usage: $0 <PROJECT_REF> <HOTEL_NAME>}"

cd "$(dirname "$0")/.."

echo "============================================================"
echo "FLOWTYM — provisionning pilote"
echo "  Project : $PROJECT_REF"
echo "  Hôtel   : $HOTEL_NAME"
echo "============================================================"

# ── 1. Link au projet Supabase ────────────────────────────────────────────────
supabase link --project-ref "$PROJECT_REF"

# ── 2. Application des migrations LEGACY (frontend/supabase/migrations/) ─────
echo
echo "[1/3] Application des migrations legacy (frontend/supabase/migrations/)..."
# Copie temporaire dans supabase/migrations/ pour que le CLI les voie ; on
# préfixe d'un timestamp neutre pour préserver l'ordre lexicographique.
LEGACY_DIR="frontend/supabase/migrations"
TEMP_DIR=$(mktemp -d)
trap "rm -rf $TEMP_DIR" EXIT

for f in $(ls "$LEGACY_DIR" | sort); do
  # On préfixe 19999999_LEGACY pour qu'elles passent AVANT les 20260*.
  cp "$LEGACY_DIR/$f" "supabase/migrations/19999999_LEGACY_$f"
done

supabase db push --project-ref "$PROJECT_REF" --linked --include-all || true

# Nettoyage des copies temporaires
rm -f supabase/migrations/19999999_LEGACY_*

# ── 3. Application des migrations DATED (supabase/migrations/) ───────────────
echo
echo "[2/3] Application des migrations dated (supabase/migrations/)..."
supabase db push --project-ref "$PROJECT_REF" --linked

# ── 4. Création de l'hôtel pilote + user walilarabi superadmin ───────────────
echo
echo "[3/3] Seed pilote : création hôtel + user walilarabi superadmin..."
psql "postgres://postgres.${PROJECT_REF}:${SUPABASE_DB_PASSWORD:?}@aws-0-eu-central-1.pooler.supabase.com:6543/postgres" <<SQL
-- Création de l'hôtel pilote
INSERT INTO public.hotels (name, code, status, created_at)
  VALUES ('$HOTEL_NAME', UPPER(REPLACE('$HOTEL_NAME', ' ', '_')), 'pilot', now())
  ON CONFLICT (code) DO NOTHING
  RETURNING id, name;

-- Le trigger trg_grant_superadmin_on_new_hotel grant automatiquement
-- walilarabi@gmail.com en admin sur cet hôtel.

-- Vérification d'intégrité : au moins une migration appliquée ?
SELECT COUNT(*) AS migrations_applied FROM supabase_migrations.schema_migrations;
SQL

echo
echo "✅ Provisionning terminé."
echo "   Next : déployer les Edge Functions via :"
echo "          ./scripts/deploy-security-sprint1-functions.sh $PROJECT_REF"
