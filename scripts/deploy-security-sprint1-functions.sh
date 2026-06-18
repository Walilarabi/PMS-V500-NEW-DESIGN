#!/usr/bin/env bash
# =============================================================================
# Security Sprint 1 — déploiement des Edge Functions patchées
# =============================================================================
# Usage : ./scripts/deploy-security-sprint1-functions.sh <SUPABASE_PROJECT_REF>
#
# Pré-requis :
#   - supabase CLI installé (npm i -g supabase)
#   - supabase login effectué
#   - SUPABASE_ACCESS_TOKEN env var ou login interactif
#
# Fonctions déployées :
#   - V3 send-dispute-email   (auth + ownership + CORS allowlist)
#   - V4 send-email           (CORS allowlist)
#   - V5 send-whatsapp        (CORS allowlist)
#   - V8 trigger-backup       (501 explicite vs stub mensonger)
#
# Idempotent. À ré-exécuter en cas de rollback.
# =============================================================================

set -euo pipefail

PROJECT_REF="${1:-hzrzkvdebaadditvbqis}"

cd "$(dirname "$0")/.."

echo "=== Sprint 1 : déploiement Edge Functions vers $PROJECT_REF ==="

for fn in send-dispute-email send-email send-whatsapp trigger-backup; do
  echo
  echo "--- Déploiement $fn ---"
  supabase functions deploy "$fn" \
    --project-ref "$PROJECT_REF" \
    --no-verify-jwt=false  # verify_jwt=true forcé (Supabase JWT check natif)
done

echo
echo "✅ Sprint 1 fonctions déployées. Validation : invoquer chaque fonction sans"
echo "   token → doit retourner 401, avec token valide → 200/202/501 selon le cas."
