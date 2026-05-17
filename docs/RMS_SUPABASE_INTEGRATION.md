# 🚀 GUIDE D'INTÉGRATION SUPABASE — MODULE RMS

**Date** : 17 Mai 2026  
**Module** : Revenue Management System  
**Status** : Prêt pour déploiement

---

## 📋 TABLE DES MATIÈRES

1. [Vue d'ensemble](#vue-densemble)
2. [Prérequis](#prérequis)
3. [Étape 1 : Migration base de données](#étape-1--migration-base-de-données)
4. [Étape 2 : Seed data](#étape-2--seed-data)
5. [Étape 3 : Configuration frontend](#étape-3--configuration-frontend)
6. [Étape 4 : Tests](#étape-4--tests)
7. [Maintenance & Monitoring](#maintenance--monitoring)

---

## 📊 VUE D'ENSEMBLE

### Architecture créée

**6 tables principales** :
1. `rms_events` — Événements impactant pricing (63 événements Paris 2026)
2. `rms_competitors` — Concurrents compset (10 concurrents Booking.com)
3. `rms_competitor_pricing` — Historique prix concurrents
4. `rms_pricing_recommendations` — Recommandations générées par l'engine
5. `rms_pricing_factors` — Détail des 11 facteurs par recommandation
6. `rms_pricing_applications` — Historique des applications avec résultats

**+ 1 vue matérialisée** :
- `rms_compset_daily_stats` — Statistiques compset par date (performance)

**+ 2 functions PostgreSQL** :
- `rms_get_event_impact_score(tenant_id, date, city)` → score 0-100
- `rms_get_compset_stats(tenant_id, date)` → stats agrégées

### Sécurité

✅ **RLS (Row Level Security)** activé sur toutes les tables  
✅ **Isolation multi-tenant** stricte  
✅ **Audit logs** sur changements de status  
✅ **Triggers** updated_at automatiques

### Performance

✅ **Indexes optimisés** sur dates, tenant_id, status  
✅ **Materialized view** pour stats agrégées  
✅ **Partitioning** préparé pour `rms_competitor_pricing` (mensuel)

---

## ✅ PRÉREQUIS

1. **Accès Supabase Dashboard** avec droits admin
2. **Tenant créé** dans la table `tenants`
3. **Extensions PostgreSQL activées** :
   - `uuid-ossp` (génération UUID)
   - `pg_cron` (optionnel, pour refresh auto des vues)

---

## 🎯 ÉTAPE 1 : MIGRATION BASE DE DONNÉES

### Option A : Via Supabase Dashboard (recommandé)

1. **Ouvrir SQL Editor** dans Supabase Dashboard
2. **Copier le contenu** de `supabase/migrations/20260517_rms_module.sql`
3. **Exécuter la migration**
4. **Vérifier les tables créées** :
   ```sql
   SELECT table_name 
   FROM information_schema.tables 
   WHERE table_name LIKE 'rms_%';
   ```
   
   Résultat attendu : 6 tables

### Option B : Via Supabase CLI (avancé)

```bash
# 1. Se connecter au projet
supabase link --project-ref <PROJECT_REF>

# 2. Appliquer la migration
supabase db push

# 3. Vérifier
supabase db diff
```

### ✅ Vérification migration

Exécuter ce SQL dans le SQL Editor :

```sql
-- Compter les tables RMS
SELECT COUNT(*) as rms_tables_count
FROM information_schema.tables 
WHERE table_name LIKE 'rms_%';
-- Attendu : 6

-- Vérifier RLS activé
SELECT tablename, rowsecurity 
FROM pg_tables 
WHERE tablename LIKE 'rms_%';
-- Toutes les tables doivent avoir rowsecurity = true

-- Tester les functions
SELECT rms_get_event_impact_score(
  '<TENANT_ID>'::UUID, 
  '2026-06-13', 
  'Paris'
);
-- Attendu : 0 (pas encore de données)
```

---

## 🌱 ÉTAPE 2 : SEED DATA

### 2.1 Récupérer le TENANT_ID

```sql
SELECT id, name FROM tenants LIMIT 1;
```

Copier l'UUID du tenant (ex: `550e8400-e29b-41d4-a716-446655440000`)

### 2.2 Charger les données initiales

1. **Ouvrir** `supabase/seeds/20260517_rms_seed_data.sql`
2. **Remplacer** `<TENANT_ID>` par l'UUID réel (ligne 15)
3. **Exécuter** dans SQL Editor

### 2.3 Vérification seed

```sql
-- Vérifier événements
SELECT COUNT(*) as events_count 
FROM rms_events 
WHERE tenant_id = '<TENANT_ID>';
-- Attendu : 63

-- Vérifier concurrents
SELECT COUNT(*) as competitors_count 
FROM rms_competitors 
WHERE tenant_id = '<TENANT_ID>' 
AND is_primary_compset = true;
-- Attendu : 10

-- Tester calcul impact
SELECT rms_get_event_impact_score(
  '<TENANT_ID>'::UUID, 
  '2026-06-13', 
  'Paris'
);
-- Attendu : 95 (Vivatech en cours ce jour-là)

-- Top 5 événements par impact
SELECT name, start_date, impact_score
FROM rms_events
WHERE tenant_id = '<TENANT_ID>'
ORDER BY impact_score DESC
LIMIT 5;
-- Attendu : Vivatech (95), Roland Garros (92), Agriculture (88)...
```

---

## ⚙️ ÉTAPE 3 : CONFIGURATION FRONTEND

### 3.1 Vérifier client Supabase

Le fichier `frontend/src/hooks/useRMSData.ts` est déjà créé avec tous les hooks.

**Hooks disponibles** :

#### Événements
- `useRMSEvents(startDate?, endDate?)` — Liste événements période
- `useRMSEventsForDate(date)` — Événements actifs pour 1 date
- `useRMSEventImpactScore(date, city?)` — Score impact 0-100

#### Compset
- `useRMSCompetitors(primaryOnly?)` — Liste concurrents
- `useRMSCompetitorPricing(competitorId, start, end)` — Prix historiques
- `useRMSCompsetStats(date)` — Stats agrégées (avg, median, min, max)

#### Recommandations
- `useRMSPricingRecommendations(start, end, status?)` — Liste recos
- `useCreatePricingRecommendation()` — Créer reco (mutation)
- `useApplyPricingRecommendation()` — Appliquer reco (mutation)
- `useRejectPricingRecommendation()` — Rejeter reco (mutation)

#### Historique
- `useRMSPricingApplications(limit?)` — Historique applications

### 3.2 Utilisation dans les composants

**Exemple** : Remplacer les données statiques par Supabase dans `RMSTableau.tsx`

```typescript
import { useRMSEvents, useRMSCompetitors } from '@/src/hooks/useRMSData';

export function RMSTableau() {
  // Remplacer PARIS_EVENTS_2026 par :
  const { data: events, isLoading } = useRMSEvents('2026-05-01', '2026-06-30');
  
  // Remplacer FOLKESTONE_COMPSET par :
  const { data: competitors } = useRMSCompetitors(true);
  
  // ...
}
```

### 3.3 Migration progressive (optionnelle)

Pour ne pas tout casser d'un coup, garder un **fallback** :

```typescript
import { PARIS_EVENTS_2026 } from '@/data/rms/events'; // Fallback statique

const { data: eventsFromDB, isLoading } = useRMSEvents(startDate, endDate);
const events = eventsFromDB || PARIS_EVENTS_2026; // Utilise DB si dispo
```

---

## 🧪 ÉTAPE 4 : TESTS

### 4.1 Tests SQL

```sql
-- Test 1 : RLS fonctionne correctement
SET app.current_tenant_id = '<TENANT_ID>';
SELECT COUNT(*) FROM rms_events;
-- Doit retourner 63

SET app.current_tenant_id = '00000000-0000-0000-0000-000000000000';
SELECT COUNT(*) FROM rms_events;
-- Doit retourner 0 (isolation tenant)

-- Test 2 : Functions
SELECT rms_get_compset_stats(
  '<TENANT_ID>'::UUID,
  CURRENT_DATE
);
-- Doit retourner NULL (pas encore de prix concurrents)

-- Test 3 : Insert recommandation
INSERT INTO rms_pricing_recommendations (
  tenant_id,
  date,
  current_price,
  recommended_price,
  delta_amount,
  delta_percent,
  confidence_score
) VALUES (
  '<TENANT_ID>',
  CURRENT_DATE + 7,
  280.00,
  315.00,
  35.00,
  12.50,
  85
);

SELECT * FROM rms_pricing_recommendations WHERE tenant_id = '<TENANT_ID>';
-- Doit retourner 1 ligne
```

### 4.2 Tests Frontend

1. **Démarrer le dev server** : `npm run dev`
2. **Naviguer** : Menu Revenue → Tableau RMS
3. **Vérifier** :
   - Timeline événements affiche les 63 événements
   - Tableau concurrents affiche les 10 concurrents
   - Aucune erreur console

### 4.3 Tests Performance

```sql
-- Expliquer plan requête événements
EXPLAIN ANALYZE
SELECT * FROM rms_events
WHERE tenant_id = '<TENANT_ID>'
  AND start_date <= '2026-06-30'
  AND end_date >= '2026-05-01'
  AND is_active = true;
-- Doit utiliser l'index idx_rms_events_dates

-- Expliquer plan stats compset
EXPLAIN ANALYZE
SELECT * FROM rms_compset_daily_stats
WHERE tenant_id = '<TENANT_ID>'
  AND date = '2026-06-15';
-- Doit être instantané (materialized view)
```

---

## 🔧 MAINTENANCE & MONITORING

### Refresh vue matérialisée (optionnel)

Si volume de données important, configurer refresh auto :

```sql
-- Option 1 : Refresh manuel
REFRESH MATERIALIZED VIEW CONCURRENTLY rms_compset_daily_stats;

-- Option 2 : Cron job (nécessite pg_cron extension)
SELECT cron.schedule(
  'refresh-rms-compset-stats',
  '0 2 * * *',  -- Tous les jours à 2h du matin
  'REFRESH MATERIALIZED VIEW CONCURRENTLY rms_compset_daily_stats'
);
```

### Monitoring volume données

```sql
-- Taille tables
SELECT 
  schemaname,
  tablename,
  pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) as size
FROM pg_tables
WHERE tablename LIKE 'rms_%'
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;

-- Nombre lignes par table
SELECT 
  'rms_events' as table_name, COUNT(*) FROM rms_events WHERE tenant_id = '<TENANT_ID>'
UNION ALL
SELECT 'rms_competitors', COUNT(*) FROM rms_competitors WHERE tenant_id = '<TENANT_ID>'
UNION ALL
SELECT 'rms_competitor_pricing', COUNT(*) FROM rms_competitor_pricing WHERE tenant_id = '<TENANT_ID>'
UNION ALL
SELECT 'rms_pricing_recommendations', COUNT(*) FROM rms_pricing_recommendations WHERE tenant_id = '<TENANT_ID>';
```

### Partitioning (si >100k lignes)

Quand `rms_competitor_pricing` dépasse 100 000 lignes, activer le partitioning mensuel :

```sql
-- Créer partitions mensuelles
CREATE TABLE rms_competitor_pricing_y2026m06 
PARTITION OF rms_competitor_pricing
FOR VALUES FROM ('2026-06-01') TO ('2026-07-01');

CREATE TABLE rms_competitor_pricing_y2026m07 
PARTITION OF rms_competitor_pricing
FOR VALUES FROM ('2026-07-01') TO ('2026-08-01');
-- etc.
```

---

## 🚨 TROUBLESHOOTING

### Erreur : "relation rms_events does not exist"

**Solution** : La migration n'a pas été appliquée correctement.
```sql
-- Vérifier si tables existent
SELECT table_name FROM information_schema.tables WHERE table_name LIKE 'rms_%';
```

### Erreur : "new row violates row-level security policy"

**Solution** : RLS bloque l'insert car `app.current_tenant_id` n'est pas défini.
```sql
SET app.current_tenant_id = '<TENANT_ID>';
```

### Performance lente sur stats compset

**Solution** : Refresh la vue matérialisée
```sql
REFRESH MATERIALIZED VIEW CONCURRENTLY rms_compset_daily_stats;
```

### Erreur : "function rms_get_event_impact_score does not exist"

**Solution** : La migration des functions a échoué. Ré-exécuter uniquement la partie functions :
```sql
-- Copier-coller uniquement la section "8. FUNCTIONS UTILITAIRES"
-- du fichier de migration
```

---

## ✅ CHECKLIST FINALE

Avant de passer en production :

- [ ] Migration appliquée (6 tables + 1 vue + 2 functions)
- [ ] RLS activé sur toutes les tables
- [ ] Seed data chargé (63 événements + 10 concurrents)
- [ ] Indexes créés et performants
- [ ] Audit logs fonctionnels
- [ ] Tests SQL passent
- [ ] Tests frontend passent
- [ ] Hooks Supabase intégrés dans RMSTableau
- [ ] Monitoring configuré
- [ ] Documentation à jour

---

## 📚 RESSOURCES

- **Migration SQL** : `supabase/migrations/20260517_rms_module.sql`
- **Seed data** : `supabase/seeds/20260517_rms_seed_data.sql`
- **Hooks React** : `frontend/src/hooks/useRMSData.ts`
- **Documentation Supabase RLS** : https://supabase.com/docs/guides/auth/row-level-security

---

**Le module RMS est prêt pour l'intégration Supabase !** 🚀
