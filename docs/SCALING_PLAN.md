# Flowtym RMS — Plan de scaling

> Ce document explique la trajectoire technique du worker Lighthouse (et plus
> largement de tout le système RMS) en fonction du nombre d'hôtels actifs.
>
> **Mise à jour de ce doc obligatoire à chaque changement de palier.**

---

## Tier 1 — 1 à 30 hôtels (ACTUEL)

**Infra :** GitHub Actions cron, 4×/jour (06:00, 12:00, 16:00, 22:00 UTC)
**Coût Actions :** 0 € (largement sous le quota gratuit GitHub)
**Coût Lighthouse :** 1098 €/mois (20 hôtels, contrat négocié — 55 €/hôtel)

**Architecture :**
```
GitHub Actions cron
  → python -m backend.workers.lighthouse_sync (1 batch, all hotels)
  → Supabase (competitor_rates upsert + worker_runs log)
```

**Performance attendue :**
- Durée par run : 2-5 min pour 20 hôtels × 4 OTAs
- ~7200 requêtes Lighthouse/jour
- 4 runs/jour × ~3 min = 12 min/jour de compute GitHub
- ~360 min/mois → 18% du quota gratuit (2000 min)

**Trigger Tier 2 :** AVG duration_seconds > 480s sur 7 jours
**Trigger Tier 2 (manuel) :** > 30 hôtels actifs

---

## Tier 2 — 30 à 150 hôtels

**Infra :** GitHub Actions matrix, 4 batches parallèles
**Coût Actions :** 0-10 €/mois (toujours dans le free tier la plupart du temps)
**Coût Lighthouse :** variable selon contrat

**Changements requis (10 minutes) :**

1. Éditer `.github/workflows/lighthouse-sync.yml` :
```yaml
jobs:
  sync:
    runs-on: ubuntu-latest
    strategy:
      fail-fast: false
      matrix:
        batch: [0, 1, 2, 3]
    env:
      BATCH_INDEX: ${{ matrix.batch }}
      BATCH_COUNT: '4'
```

2. Le worker est déjà partition-aware — aucun changement de code requis.
   Le filtrage utilise `md5(hotel_id) % batch_count == batch_index`, stable
   à l'ajout/retrait d'hôtels.

**Performance attendue :**
- 4 jobs parallèles, ~3-5 min chacun
- Durée wall-clock par run : 3-5 min (au lieu de 12-15 min séquentiel)

**Trigger Tier 3 :**
- AVG duration_seconds > 480s même avec 4 batches
- OU > 150 hôtels actifs
- OU besoin de War Room (sync à la demande < 1 min)

---

## Tier 3 — 150 à 500 hôtels

**Infra :** Worker Python dédié hébergé (Railway / Fly / Render)
**Coût :** ~30 €/mois (worker 0.5 vCPU + 512MB) + Upstash Redis gratuit
**Coût Lighthouse :** négocié au volume

**Changements requis (2-3 jours) :**

1. **Déployer le worker en mode `--watch`** (APScheduler interne, déjà supporté).
2. **Ajouter Redis Upstash** pour :
   - Rate limiting distribué token-bucket sur l'API Lighthouse
   - Idempotency keys sur les syncs (éviter double-traitement)
   - Queue prioritaire pour War Room (syncs à la demande)
3. **Migrer du cron Actions vers le scheduler interne**.
4. **Endpoint REST `POST /v1/rms/sync-now`** pour déclencher un sync manuel
   depuis l'UI admin (déjà prévu dans server.py).

**Performance attendue :**
- Worker en mémoire, pas de cold start
- Sync à la demande < 30s
- War Room mode : refresh 1×/heure sur dates critiques

**Trigger Tier 4 :**
- AVG duration_seconds > 600s même avec worker dédié
- OU > 500 hôtels actifs
- OU besoin de sync temps réel (< 5 min de latence)

---

## Tier 4 — 500 à 1000+ hôtels

**Infra :** Cluster de workers Python/Node avec BullMQ + Redis production
**Coût :** ~80-150 €/mois infra + Lighthouse au volume

**Changements requis (1 semaine) :**

1. **BullMQ queue + workers horizontaux** :
   - 1 queue `lighthouse-sync-hotels`
   - N workers (1 par 100 hôtels)
   - Auto-scaling Kubernetes ou Railway autoscaling
2. **Sharding base de données Supabase** (optionnel, déclenché à 800+ hôtels)
3. **Partitioning Postgres sur `competitor_rates`** par mois (TimescaleDB recommandé)
4. **Webhook Lighthouse** si disponible (à confirmer avec Damien Breton)

---

## Métriques de surveillance

La vue `public.scaling_health` agrège les métriques utiles. Requête type :

```sql
SELECT * FROM public.scaling_health WHERE worker_name = 'lighthouse_sync';
```

Sortie type Tier 1 :
```
worker_name     | runs_last_7d | avg_duration_7d | max_duration_7d | hotels_processed_7d | tier_status
lighthouse_sync | 28           | 187s            | 240s            | 560                 | healthy
```

**Seuils tier_status :**
- `healthy` : avg < 300s
- `watch_closely` : 300s < avg < 480s → planifier la migration
- `upgrade_recommended` : avg > 480s → migrer DANS LE MOIS

---

## Coûts cumulés par tier (estimation)

| Tier | Hôtels | Infra/mois | Lighthouse/mois | Total/mois | €/hôtel |
|---|---|---|---|---|---|
| 1 | 20 | 0 € | 1098 € | 1098 € | 55 € |
| 2 | 100 | 10 € | ~5500 € | ~5510 € | 55 € |
| 3 | 300 | 30 € | ~14400 € | ~14430 € | 48 € (négocié au vol) |
| 4 | 800 | 150 € | ~28000 € | ~28150 € | 35 € (négocié grand vol) |

À volume, Lighthouse est négociable autour de 30-40 €/hôtel.

---

## Décision automatique de migration

Le frontend admin doit afficher un badge "Migrer le worker vers Tier N" dans le
dashboard admin quand :

```sql
SELECT tier_status FROM public.scaling_health
WHERE worker_name = 'lighthouse_sync';
```

retourne `'upgrade_recommended'` pendant 7 jours consécutifs.

Cette logique sera implémentée dans une page admin `/admin/scaling-health`
en Tier 1, mais pas avant que le besoin se présente.
