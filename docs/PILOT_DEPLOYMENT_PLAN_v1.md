# Plan de Déploiement Pilote Flowtym PMS v1

**Version** : 1.0  
**Date** : 2026-06-18  
**Auteur** : Équipe Flowtym (CTO / Direction Projet / Support / Exploitation / Sécurité)  
**État du système** : `main` HEAD `5d1cca6` — security-sprint-1/2 + devops-sprint-1 mergés et déployés  
**Cible** : 1 hôtel pilote (environnement prod existant `hzrzkvdebaadditvbqis` ou environnement dédié)

---

## Table des matières

1. [Checklist technique de mise en production](#1-checklist-technique-de-mise-en-production)
2. [Procédure de rollback / PRA simplifié](#2-procédure-de-rollback--pra-simplifié)
3. [Plan de sauvegarde — RPO / RTO](#3-plan-de-sauvegarde--rpo--rto)
4. [Plan de monitoring](#4-plan-de-monitoring)
5. [Plan de support pilote (L1/L2/L3)](#5-plan-de-support-pilote-l1l2l3)
6. [Plan de formation](#6-plan-de-formation)
7. [Collecte des retours pilote](#7-collecte-des-retours-pilote)
8. [Gestion des incidents](#8-gestion-des-incidents)
9. [Critères de réussite du pilote](#9-critères-de-réussite-du-pilote)
10. [Critères de sortie du pilote](#10-critères-de-sortie-du-pilote)

---

## 1. Checklist technique de mise en production

### 1.1 Infrastructure

| # | Élément | Statut | Détail / action |
|---|---|---|---|
| 1.1.1 | **Vercel — projet provisionné** | ✅ Prêt | Domaine prod déjà connecté |
| 1.1.2 | Vercel — `buildCommand`, `outputDirectory`, rewrites SPA | ✅ Prêt | `vercel.json` racine + headers HSTS/X-Frame-Options/CSP-ready |
| 1.1.3 | Vercel — variables d'env prod | ⚠️ À vérifier | `VITE_SUPABASE_URL` et `VITE_SUPABASE_ANON_KEY` actuellement dans `frontend/vercel.json` (publiques par design Supabase). Déplacer vers Vercel Project Settings pour pouvoir pivoter sans rebuild. Effort : 10 min |
| 1.1.4 | Vercel — `VITE_SENTRY_DSN` (optionnel mais recommandé) | ❌ Manquant | Achat licence Sentry ou Datadog (~$26/mois Team) + DSN à configurer ; module `installSentry()` déjà prêt. Effort : 30 min |
| 1.1.5 | Vercel — `VITE_LIGHTHOUSE_API_KEY` (optionnel selon pilote) | ❌ Manquant | Si hôtel pilote a abonnement Lighthouse, configurer. Sinon UI sera en "mode démo" sur Veille Concurrentielle |
| 1.1.6 | Vercel — `VITE_APP_VERSION` (corrélation logs) | ⚠️ À vérifier | Tag commit ou semver. Permet de croiser erreur Sentry et version déployée |
| 1.1.7 | Vercel — Cache headers assets / index.html | ✅ Prêt | Assets immutables 1 an ; index.html no-cache |
| 1.1.8 | Vercel — Domaine custom (pilote) | ⚠️ À configurer | Ex : `pilote.flowtym.com` ou sous-domaine hôtel. Effort : 1h (DNS + cert auto) |
| 1.1.9 | **Supabase — projet ACTIVE_HEALTHY** | ✅ Prêt | `hzrzkvdebaadditvbqis` en eu-central-1, PG 17.6.1 |
| 1.1.10 | Supabase — RLS activée sur 100% tables critiques | ✅ Prêt | Validé hands-on phase 4 (13 dimensions × 2 hôtels) |
| 1.1.11 | Supabase — 160 migrations appliquées | ✅ Prêt | Confirmé via `list_migrations` post-merge |
| 1.1.12 | Supabase — Edge Functions critiques (verify_jwt=true) | ✅ Prêt | 3 redéployées en sprint-1 (`send-dispute-email` v1, `send-whatsapp` v9, `trigger-backup` v1) |
| 1.1.13 | Supabase — `send-email` déployée | ❌ Manquant | Script `scripts/deploy-security-sprint1-functions.sh` prêt. À exécuter par ops si l'hôtel pilote utilise email transactionnel |
| 1.1.14 | Supabase — plan (Free vs Pro) | ⚠️ À décider | Pour pilote 1 hôtel : Free OK ; cibler **Pro $25/mois** pour SLA + backups PITR 7 jours |
| 1.1.15 | **DNS** — TXT SPF / DKIM / DMARC pour domaine d'envoi email | ⚠️ À configurer | Pour Resend : ajouter records dans DNS hôtelier ou domaine Flowtym |
| 1.1.16 | DNS — CAA records (option) | ⚠️ Optionnel | Restreint qui peut émettre des certificats |
| 1.1.17 | **SMTP / Resend** — clé API en env Edge Function | ⚠️ À vérifier | `RESEND_API_KEY` dans Supabase secrets — pas dans le code. Vérifier en console Supabase |
| 1.1.18 | SMTP / Resend — vérification domaine d'envoi | ⚠️ À faire | DKIM/SPF validés par Resend avant pilote |
| 1.1.19 | SMTP / Resend — quota pilote (free 100 emails/jour) | ⚠️ Surveiller | Upgrade à 50k emails/mois ($20) si volume |
| 1.1.20 | **Variables d'env globales** | ⚠️ Audit final | `ALLOWED_ORIGINS` (Edge Functions), `RESEND_FROM_EMAIL`, `RESEND_FROM_NAME`, `META_GRAPH_VERSION`, `GOOGLE_CLIENT_*`, `MS_CLIENT_*` |
| 1.1.21 | **Sauvegardes** — voir [§3](#3-plan-de-sauvegarde--rpo--rto) | ⚠️ Voir détail | Snapshots Supabase Pro + script `trigger-backup` (retourne 501 actuellement = Option B Sprint 1) |
| 1.1.22 | **Monitoring** — voir [§4](#4-plan-de-monitoring) | ⚠️ Voir détail | À structurer |
| 1.1.23 | **Logs** — Vercel + Supabase Dashboard | ✅ Prêt | Rétention par défaut suffisante pour pilote |

### 1.2 Sécurité

| # | Élément | Statut | Détail |
|---|---|---|---|
| 1.2.1 | **JWT** — `verify_jwt=true` sur Edge Functions sensibles | ✅ Prêt | Validé hands-on phase 4 : 401 sur appel anonyme |
| 1.2.2 | JWT — durée de vie / rotation | ⚠️ À vérifier | Défaut Supabase 1h access token + 1 semaine refresh. Acceptable pour pilote |
| 1.2.3 | **Permissions / rôles** — enum `admin_user_role` complet | ✅ Prêt | `super_admin`, `admin_hotel`, `direction`, `reception`, `housekeeping`, etc. |
| 1.2.4 | RPC `admin_grant_hotel`, `admin_revoke_hotel`, `admin_set_hotel_role` | ✅ Prêt | Toutes guards `is_platform_admin()` |
| 1.2.5 | **Multi-hôtels** — `get_user_hotel_id()` + `user_hotels` + `user_active_hotel` | ✅ Prêt | Validé hands-on phase 4 (52 tests cross-tenant) |
| 1.2.6 | **RLS** — toutes tables métier | ✅ Prêt | 100% des tables sensibles avec policy `hotel_id = get_user_hotel_id() OR is_platform_admin()` |
| 1.2.7 | RLS — 8 vues `security_invoker=true` | ✅ Prêt | financial_timeline, debtors_aged, v_hr_monthly_cost, etc. |
| 1.2.8 | **MFA réel (TOTP)** | ❌ Manquant (simulé localStorage) | Sprint Sécurité 3 — peut être différé post-pilote si admins identifiés |
| 1.2.9 | **`auth_leaked_password_protection`** | ❌ Manquant | **À activer avant pilote** : Dashboard Supabase → Auth → Settings → Password security. 5 min ops. Voir `docs/ops/V12-leaked-password-protection.md` |
| 1.2.10 | Politique de mot de passe (longueur minimum) | ⚠️ À vérifier | Dashboard Supabase → Auth → Settings. Recommandé : 10 chars + classes |
| 1.2.11 | Audit log immuable (`audit_logs` append-only) | ✅ Prêt | 3 triggers : `no_update`, `no_delete`, `chain_link` cryptographique |
| 1.2.12 | Compte superadmin walilarabi tracé + révocable | ⚠️ Partiel | Existant, MFA non activé. Recommandé : ajouter MFA TOTP manuel via dashboard Supabase + créer un 2e compte break-glass |
| 1.2.13 | CORS allowlist sur Edge Functions critiques | ✅ Prêt | V3+V4+V5 sprint-1 |
| 1.2.14 | Secrets / API keys en repo | ✅ Prêt | Aucun secret sensible en repo (anon key publique par design) |
| 1.2.15 | Sourcemaps en prod | ⚠️ À vérifier | Vite par défaut ne génère pas de sourcemap → OK. Ajouter explicitement `build.sourcemap=false` dans `vite.config.ts` pour figer |

### 1.3 Performance

| # | Élément | Statut | Détail |
|---|---|---|---|
| 1.3.1 | Bundle size (top chunks) | ⚠️ À optimiser post-pilote | `vendor-pdf` 1MB non lazy ; PlanningViewLive 2879 lignes sans memo. Acceptable pour pilote 1 hôtel |
| 1.3.2 | Code splitting (lazy loading routes) | ✅ Prêt | 20+ chunks via `lz()` helper dans `App.tsx` |
| 1.3.3 | Cache HTTP (assets immutables 1 an) | ✅ Prêt | Vercel headers OK |
| 1.3.4 | Cache TanStack Query | ⚠️ Vérifier | `staleTime` par défaut. Recommandé : valeurs explicites pour réduire requêtes |
| 1.3.5 | Polling 30s (Finance, SAS, Billing) | ⚠️ Surveiller | Coût ~$85/mois sur Supabase polling. Migration Realtime prévue Sprint 4 |
| 1.3.6 | Disponibilité cible pilote | ⚠️ À monitorer | Cible : > 99% (dépend Vercel + Supabase, SLA Pro 99.95%) |
| 1.3.7 | Temps de chargement first paint < 2s | ⚠️ À mesurer | Lighthouse audit recommandé sur preview Vercel |
| 1.3.8 | Monitoring erreurs frontend | ⚠️ Partiel | Module `observability.ts` prêt, ring buffer 100 events. Sentry DSN à brancher pour persistance |

---

## 2. Procédure de rollback / PRA simplifié

### 2.1 Matrice décisionnelle

| Symptôme observé | Sévérité | Décision | Délai cible |
|---|---|---|---|
| PMS totalement inaccessible (Vercel down) | 🔴 Critique | Rollback Vercel | < 5 min |
| Crash JS sur 1 page (autres OK) | 🟠 Majeur | Hotfix ou rollback partiel | < 4h |
| Régression sur 1 workflow (ex : pricing) | 🟠 Majeur | Rollback ciblé branche | < 8h |
| Perte de données apparente | 🔴 Critique | **Stop tout** → restauration backup | < 1h diagnostic + 4h restore |
| Indisponibilité Supabase (incident côté Supabase) | 🔴 Critique | Communication clients + attente | Selon Supabase status |
| Corruption d'une ligne (modif frauduleuse, mauvais UPDATE) | 🟠 Majeur | Restoration ciblée via audit_logs | < 2h |
| Fuite cross-tenant suspectée | 🔴 Critique | Disable app + audit forensique | < 30 min |

### 2.2 Procédure A — Rollback Vercel (frontend)

**Quand** : un déploiement frontend casse l'app (ex : régression non détectée en CI).

**Comment** :
1. Vercel Dashboard → Projet Flowtym → Deployments
2. Identifier le dernier déploiement stable (avant régression)
3. Cliquer "Promote to Production" sur ce déploiement
4. Vercel re-route le trafic prod vers le snapshot précédent

**Délai** : 2-5 min  
**Données concernées** : aucune (frontend = code uniquement)  
**Intervenant** : développeur ou admin Vercel  
**Communication** : message in-app via toast si Sentry actif

### 2.3 Procédure B — Rollback DB (migration cassée)

**Quand** : une migration SQL provoque un comportement non désiré (ex : trigger trop restrictif).

**Comment** :
1. Identifier la migration fautive via `list_migrations` MCP ou Supabase Dashboard
2. Préparer une migration de rollback inverse (DROP/RECREATE objets)
3. Tester sur staging (Supabase branch ou projet copie)
4. Appliquer via `apply_migration` MCP ou Supabase CLI sur prod
5. Vérifier `get_advisors` post-rollback

**Délai** : 30 min - 2h selon complexité  
**Données concernées** : aucune si rollback DDL pur. Si schéma altéré (DROP COLUMN) → restauration backup nécessaire  
**Intervenant** : développeur backend  
**Communication** : incident notice via canal pilote (Slack/WhatsApp)

### 2.4 Procédure C — Restoration backup Supabase

**Quand** : perte de données réelle (suppression accidentelle, corruption, attaque).

**Comment** :
1. **STOP** toutes écritures : `ALTER DATABASE postgres SET default_transaction_read_only = on` (rapide, réversible) OU détacher l'app du DB
2. Identifier le point de restauration via Supabase Dashboard → Database → Backups → PITR (Point In Time Recovery)
3. Supabase Pro : PITR jusqu'à 7 jours en arrière, granularité seconde
4. Lancer restoration vers un projet temporaire (Supabase clone)
5. Diff entre prod corrompue et clone restauré (script SQL ad-hoc)
6. Importer les bonnes données dans prod
7. Réactiver écritures

**Délai** : 1h diagnostic + 30 min - 4h restoration selon volume  
**Données concernées** : selon point de restauration choisi  
**Intervenant** : développeur backend + admin Supabase  
**Communication** : incident critique → user notification + post-mortem

### 2.5 Procédure D — Rollback Edge Function

**Quand** : nouveau déploiement Edge Function casse un workflow (ex : envoi email échoue).

**Comment** :
1. Supabase Dashboard → Edge Functions → `<fn-slug>` → Versions
2. Identifier la version précédente fonctionnelle
3. Cliquer "Promote" sur la version stable
4. Alternative CLI : `supabase functions deploy <fn-slug> --project-ref hzrzkvdebaadditvbqis` après `git checkout <commit-stable>` du code source

**Délai** : 5-15 min  
**Données concernées** : aucune (Edge Function = code)  
**Intervenant** : développeur backend

### 2.6 PRA — Tableau de bord d'urgence

| Composant | Procédure | Délai cible | Données impactées |
|---|---|---|---|
| Vercel frontend | A | < 5 min | Aucune |
| Migration DB | B | < 2h | DDL seulement (si DML : voir C) |
| Données DB | C | < 4h | Selon PITR choisi |
| Edge Function | D | < 15 min | Aucune |
| Supabase total down | Attente vendor + comm | Selon SLA | Aucune (lecture seule pendant down) |
| DNS pointe vers mauvais env | Update DNS TTL court | < 30 min | Aucune |

---

## 3. Plan de sauvegarde — RPO / RTO

### 3.1 Base de données

| Couche | Mécanisme actuel | RPO actuel | RTO actuel | RPO cible | RTO cible | Action |
|---|---|---|---|---|---|---|
| Supabase managed daily backup | Snapshot quotidien (Free + Pro) | 24h | 30 min - 2h | 24h | 30 min | ✅ Acceptable pilote |
| Supabase PITR | Continuous WAL ship (Pro) | < 5 min (continu) | 1-4h | < 5 min | < 2h | ⚠️ **Upgrader plan Pro avant pilote** |
| Backup tenant-scoped (`trigger-backup` Edge Function) | ❌ Stub (501 NOT_IMPLEMENTED) | N/A | N/A | 1h (cron horaire) | < 1h | 🔵 Sprint 4 (Plan A étendu) |
| Backup hors site (S3/Backblaze) | ❌ Non implémenté | N/A | N/A | 24h | 4h | 🔵 Sprint 4 ou 5 |

**RPO/RTO globaux retenus pour pilote** :
- **RPO** : 24h (snapshot) si plan Free, **< 5 min** si plan Pro avec PITR. **Recommandation forte : Pro avant pilote**.
- **RTO** : 1-2h pour restoration sur clone + import diff.

### 3.2 Documents (Supabase Storage)

| Bucket | Contenu | RLS | Sauvegarde |
|---|---|---|---|
| `communication-attachments` | Pièces jointes emails / WhatsApp | ✅ Par hotel_id | Inclus dans backup Supabase |
| `contracts-archive` | Contrats signés (PDF) | ✅ Par hotel_id | Inclus dans backup Supabase |
| `employee-documents` | Passeports, pièces d'identité, justificatifs RH | ✅ Par hotel_id + RBAC | Inclus dans backup Supabase |
| `invoices-pdf` (si actif) | Factures émises | ✅ Par hotel_id | Inclus dans backup Supabase |

⚠️ **Limite actuelle** : Supabase Storage est inclus dans les backups managés du projet. Pour pilote avec données légales sensibles (passeports), recommandation forte d'**activer la duplication vers un bucket S3 externe** (sprint post-pilote si volume > 500 docs).

### 3.3 Configuration

| Élément | Backup | Versionnage |
|---|---|---|
| Paramètres hôtels (`hotels` + settings tables) | ✅ Inclus DB backup | RLS hotel_id |
| Rôles & enums | ✅ Inclus DB backup (DDL) | Versionné en migrations |
| Utilisateurs (`auth.users`, `public.users`, `user_hotels`) | ✅ Inclus DB backup | audit_logs |
| Edge Functions | ✅ Versionning Supabase | Code en git |
| Schéma SQL | ✅ Migrations git + Supabase | Versionné |
| Frontend code | ✅ Git + Vercel deployment history | Versionné |

### 3.4 Procédure de validation backup (à exécuter avant pilote)

```text
[ ] Vérifier dans Supabase Dashboard → Database → Backups que le dernier snapshot < 24h
[ ] Activer PITR (plan Pro requis)
[ ] Effectuer 1 restoration test sur projet clone (RTO réel mesuré)
[ ] Documenter la procédure dans docs/ops/RESTORE_PROCEDURE.md
[ ] Tester restoration de 1 bucket Storage (download → re-upload)
[ ] Mesurer le RTO réel et l'inscrire dans le contrat pilote
```

---

## 4. Plan de monitoring

### 4.1 Incidents critiques surveillés

| Incident | Détection | Alerte | Délai d'alerte cible |
|---|---|---|---|
| Indisponibilité PMS (Vercel down ou app HS) | Healthcheck externe (UptimeRobot ou BetterStack) | Slack + SMS admin | < 2 min |
| Erreur connexion (Supabase Auth) | Sentry → tag `auth_error` | Slack admin | < 5 min |
| Erreur création réservation | Sentry → tag `reservation_create_failed` | Slack support | < 15 min |
| Erreur facturation (RPC `next_invoice_number` 42501) | Logs Supabase → query | Slack admin | < 1h (batch) |
| Erreur paiement (`payments.status='failed'` consécutifs) | Vue Supabase + cron query | Slack admin | < 1h |
| Erreur RH (signature contrat échoue) | Sentry + audit_logs | Slack support | < 1h |
| Modification frauduleuse facture émise | `audit_logs WHERE entity='invoice' AND action='updated' AND diff ?| array['total_ttc',...]` | Email admin + ticket | < 24h (cron quotidien) |
| Cross-tenant tentative (Forbidden 42501 sur RPC sécurisée) | Logs Supabase | Slack sécurité | < 1h |

### 4.2 Outils retenus

#### Niveau minimum pilote (gratuit ou ~$30/mois)

| Outil | Rôle | Coût | État |
|---|---|---|---|
| **Vercel Analytics** | Page views, perf basique | Inclus | ✅ Activer |
| **Supabase Dashboard logs** | DB queries + Edge Function logs | Inclus | ✅ Disponible |
| **UptimeRobot** | Healthcheck `https://<app>.vercel.app/` | Free 50 monitors | ⚠️ À configurer |
| **Sentry Team** (recommandé) | Erreurs frontend + traces | $26/mois | ⚠️ Achat + DSN config |
| **Slack** ou **WhatsApp groupe Pilote** | Canal d'alerte | Gratuit | ⚠️ Créer canal dédié |

#### Niveau scale (post-pilote, 10+ hôtels)

| Outil | Rôle | Coût estimé |
|---|---|---|
| **Datadog** ou **BetterStack** | APM + logs structurés + uptime | $40-100/mois |
| **PagerDuty** | Astreinte + escalade | $20/user/mois |
| **Snyk** ou **Dependabot** | Alertes CVE deps | Inclus GitHub |

### 4.3 Journaux — où consulter quoi

| Type de log | Lieu | Rétention | Recherche |
|---|---|---|---|
| Erreurs frontend JS | Sentry (si configuré) sinon `window.__flowtymErrors` (ring buffer 100 events) | 30 jours (Team plan) | Sentry UI |
| Erreurs frontend Vercel build/runtime | Vercel Dashboard → Logs | 7 jours (Free), 30 jours (Pro) | Vercel UI |
| Requêtes API Supabase (PostgREST) | Supabase Dashboard → Logs → API Logs | 7 jours (Pro) | SQL filter |
| Erreurs Edge Functions | Supabase Dashboard → Edge Functions → `<slug>` → Logs | 7 jours (Pro) | Filter par function |
| Audit log métier (CRUD) | Table `public.audit_logs` (append-only, chaîne crypto) | Indéfini | SQL direct |
| Settings audit | Table `public.settings_audit_log` | Indéfini | SQL direct |
| Erreurs SQL / triggers | Supabase Dashboard → Database → Logs | 7 jours (Pro) | Filter pgaudit |
| Tentatives login échouées | `auth.audit_log_entries` | Voir config | SQL `auth` schema |
| Tentatives cross-tenant | `audit_logs WHERE payload->>'severity'='CRITICAL'` (post Sprint 4) | Indéfini | SQL |

### 4.4 Tableau de bord pilote (à créer avant lancement)

Créer dans Supabase Studio (SQL Editor) une vue `pilot_health_dashboard` :

```sql
-- À déployer en Sprint 4 (documenté ici, pas développé)
CREATE OR REPLACE VIEW public.pilot_health_dashboard AS
SELECT
  'reservations_24h'  AS metric, COUNT(*)::text AS value
  FROM public.reservations WHERE created_at > now() - interval '24h'
UNION ALL
SELECT 'invoices_24h', COUNT(*)::text
  FROM public.invoices WHERE created_at > now() - interval '24h'
UNION ALL
SELECT 'payments_failed_24h', COUNT(*)::text
  FROM public.payments WHERE status='failed' AND created_at > now() - interval '24h'
UNION ALL
SELECT 'invoice_financial_modifications_post_issue',
       COUNT(*)::text
  FROM public.audit_logs
  WHERE entity='invoice' AND action='updated'
    AND payload->'diff' ?| array['total_ttc','total_ht','total_tva','paid_amount']
    AND created_at > now() - interval '24h'
UNION ALL
SELECT 'auth_failed_logins_24h',
       COUNT(*)::text FROM auth.audit_log_entries
  WHERE payload->>'action'='login_failed' AND created_at > now() - interval '24h';
```

À consulter quotidiennement pendant les 2 premières semaines du pilote.

---

## 5. Plan de support pilote (L1/L2/L3)

### 5.1 Niveau 1 — Utilisateur hôtel (réception, direction)

**Responsabilité** : premier point de contact sur le terrain.

**Périmètre** :
- Vérifier qu'il s'agit d'un vrai problème (vs erreur de manipulation)
- Consulter le mode d'emploi / FAQ (à créer — voir §6)
- Tenter un refresh navigateur, reconnexion
- Documenter le problème (capture + étapes pour reproduire)
- Escalader vers L2 via canal pilote (Slack/WhatsApp/email)

**Temps de réponse interne** : immédiat (sur place)

**Escalade L1 → L2** : sous 15 min ouvrées si problème non résolu

### 5.2 Niveau 2 — Administration Flowtym (équipe support)

**Responsabilité** : diagnostic fonctionnel + résolution sans intervention dev.

**Périmètre** :
- Vérification compte / permissions / hôtel actif
- Consultation logs Vercel + Supabase Dashboard
- Reset password / aide récupération compte
- Correction config hôtel (paramètres, rôles, etc.)
- Réinjection donnée manuelle si bug léger
- Décision d'escalade L3 si bug technique

**Personne désignée pilote** : `walilarabi@gmail.com` (superadmin) + 1 backup à identifier

**Temps de réponse** :
- 🔴 Critique : 30 min (heures ouvrées) / 2h (24/7 pendant pilote)
- 🟠 Majeur : 2h ouvrées
- 🟡 Mineur : 1 jour ouvré

**Outils L2** :
- Dashboard Supabase (RLS bypass via service_role)
- Vercel Dashboard
- Console SQL pour requêtes ad-hoc
- Accès canal Slack/WhatsApp pilote

### 5.3 Niveau 3 — Développement

**Responsabilité** : correction de bugs, déploiements, intervention DB sensible.

**Périmètre** :
- Correction code (hotfix branch + PR + merge + déploy)
- Migration DB urgente (avec rollback préparé)
- Restoration backup
- Audit forensique (corrélation logs / fraud detection)
- Modification trigger / RPC

**Personne désignée pilote** : développeur principal (joignable astreinte)

**Temps de réponse cible** :
- 🔴 Critique : 1h (heures ouvrées) / 4h (24/7 pendant pilote)
- 🟠 Majeur : 4h ouvrées
- 🟡 Mineur : 3 jours ouvrés

**Procédure d'escalade L2 → L3** :
1. L2 ouvre un ticket structuré (issue GitHub ou doc partagé) avec :
   - Sévérité (🔴🟠🟡)
   - Reproduction étape par étape
   - Captures + logs
   - Workaround temporaire si trouvé
2. L3 prend en charge sous délai cible
3. L3 communique avancement toutes les 2h en cas d'incident critique
4. L3 livre la correction + test régression + post-mortem si critique

---

## 6. Plan de formation

### 6.1 Profil Réception (durée totale : 4h, idéalement réparties sur 2 j)

| # | Module | Durée | Pré-requis | Support |
|---|---|---|---|---|
| 1 | Login + navigation générale | 20 min | - | Démo live + mode d'emploi PDF |
| 2 | Création réservation (Flowday → Planning) | 30 min | M1 | Vidéo + cas concrets |
| 3 | Modification / annulation résa | 20 min | M2 | Vidéo |
| 4 | Check-in (changement status + clé) | 30 min | M2 | Démo |
| 5 | Check-out + génération facture + paiement | 45 min | M4 | Démo + exercice (3 résas test) |
| 6 | Recherche / création client (CRM léger) | 30 min | M1 | Démo |
| 7 | Modale Réservation — détails / billing / cardex / incidents | 30 min | M5 | Démo |
| 8 | Cas spéciaux : surbooking, changement chambre, no-show | 30 min | M5 | Cas pratiques |
| 9 | Communications email/WhatsApp client | 20 min | M5 | Démo |
| 10 | FAQ + escalade vers admin hôtel | 15 min | tous | Document partagé |

**Support** : mode d'emploi PDF 30 pages + 6 captures vidéo courtes (< 3 min chacune).

**Ordre recommandé** : strict (chaque module dépend du précédent).

### 6.2 Profil Direction (durée totale : 6h)

| # | Module | Durée | Périmètre |
|---|---|---|---|
| 1 | Vue d'ensemble + démo PMS complète | 1h | Tous modules |
| 2 | Reporting financier (FEC, factures, paiements, débiteurs) | 1h | Finance Layout |
| 3 | Module Revenue Management (RMS, Pricing, Forecast) | 1h | Revenue |
| 4 | Module SAS — OTA Dispute Center | 30 min | SAS |
| 5 | Module RH — accès manager (planning, contrats, absences) | 1h | RH |
| 6 | Paramétrage hôtel (chambres, plans tarifaires, partenaires OTA, communication) | 1h | Settings |
| 7 | Gestion utilisateurs (créer / inviter / rôles) | 30 min | Admin |
| 8 | Lecture des KPIs et alertes | 30 min | Analyse |

**Support** : démo personnalisée + accès sandbox.

**Ordre recommandé** : 1 → 7 → 6 → 2 → 5 → 3 → 4 → 8.

### 6.3 Profil RH (durée totale : 3h, peut être direction ou gestionnaire RH dédié)

| # | Module | Durée |
|---|---|---|
| 1 | Création / modification employé + contrats | 45 min |
| 2 | Planning et coverage rules | 45 min |
| 3 | Absences (demande, approbation, soldes) | 30 min |
| 4 | Pointages (QR code + manuels) | 30 min |
| 5 | Portail salarié (accès employé) | 30 min |

### 6.4 Onboarding hôtel pilote (avant J1 du pilote)

**Semaine -2** :
- Réunion kickoff (1h) : présentation équipe + agenda pilote
- Création environnement pilote (provisioning hôtel via `scripts/provision-pilot-hotel.sh`)
- Import données existantes (chambres, plans tarifaires, employés) — script à préparer

**Semaine -1** :
- Formation réception (J1+J2)
- Formation direction (J3)
- Formation RH (J4)
- Test acceptation utilisateur (J5)

**Semaine 0** : lancement pilote + présence support sur site J1-J3

---

## 7. Collecte des retours pilote

### 7.1 Workflow de remontée

```
[Utilisateur hôtel]
      │
      ▼
[Canal Slack/WhatsApp #pilote-flowtym]
      │
      ▼
[Triage L2 : classification + ticket]
      │
      ▼
[Tableau Notion ou GitHub Issues : pilote-feedback]
      │
      ▼
[Décision : 🔴 hotfix / 🟠 backlog sprint / 🟡 backlog futur / 🟢 wishlist]
```

### 7.2 Modèle de ticket pilote

```yaml
Titre: [Module] - Description courte
Date: YYYY-MM-DD
Utilisateur: Prénom Nom (rôle)
Hôtel: Nom hôtel
Module: PMS / Revenue / SAS / RH / Settings / etc.
Sévérité: 🔴 Critique / 🟠 Important / 🟡 Amélioration / 🟢 Suggestion
Catégorie: Bug / Demande amélioration / Incompréhension utilisateur / Performance / Sécurité
Reproduction:
  - Étape 1 ...
  - Étape 2 ...
  - Étape 3 ...
Comportement attendu: ...
Comportement observé: ...
Captures: [liens]
Impact: nombre d'utilisateurs concernés, fréquence
Workaround temporaire: oui/non + description
Statut: Nouveau / En triage / En cours / Résolu / Rejeté
Assigné à: L2 / L3
SLA cible: voir §8
```

### 7.3 Outils

**Minimum pilote (gratuit)** :
- Canal Slack `#pilote-flowtym` ou groupe WhatsApp dédié
- GitHub Issues sur repo `Walilarabi/PMS-V500-NEW-DESIGN` avec labels `pilot`, `critical`, `major`, `minor`, `suggestion`
- Doc partagé (Notion / Google Docs) pour vue agrégée hebdo

**Recommandé scale** :
- Linear / Jira / Notion projects
- Intercom pour support in-app

### 7.4 Revue hebdomadaire pilote

Chaque vendredi pendant la durée du pilote :
- 30 min revue tickets (par sévérité)
- 30 min décisions correctifs sprint suivant
- 30 min retour utilisateurs (satisfaction)
- Rapport hebdo envoyé au commanditaire (direction hôtel + Flowtym CTO)

---

## 8. Gestion des incidents

### 8.1 Incidents critiques (🔴)

**Exemples** : PMS inaccessible, perte de réservation, erreur facturation systémique, panne générale, fuite cross-tenant suspectée.

| Action | Délai cible |
|---|---|
| Détection (alerte ou utilisateur) | T0 |
| Acknowledgement L2 (message Slack/WhatsApp) | T0 + 30 min (ouvrés) / 2h (24/7) |
| Diagnostic initial | T0 + 1h |
| Communication utilisateur (statut + ETA) | T0 + 1h |
| Workaround / rollback déployé | T0 + 4h |
| Résolution finale | T0 + 24h (ouvrés) |
| Post-mortem écrit | T+72h |
| Communication post-mortem aux pilote | T+5j |

**Canal de communication** : Slack + email synthèse + appel téléphonique direction si pertinent.

### 8.2 Incidents majeurs (🟠)

**Exemples** : fonctionnalité indisponible (ex : envoi email OTA dispute), ralentissements observés.

| Action | Délai cible |
|---|---|
| Acknowledgement | < 2h ouvrées |
| Diagnostic | < 4h ouvrées |
| Workaround | < 8h ouvrées |
| Résolution finale | < 3 jours ouvrés |
| Communication utilisateur | Statut quotidien jusqu'à résolution |

### 8.3 Incidents mineurs (🟡 / 🟢)

**Exemples** : problème ergonomique, bug non bloquant, typo, suggestion d'amélioration.

| Action | Délai cible |
|---|---|
| Acknowledgement | < 1 jour ouvré |
| Décision (backlog ou rejet motivé) | < 1 semaine |
| Résolution si retenue | Sprint suivant ou ultérieur |

### 8.4 Tableau d'astreinte (suggestion)

| Période | L2 | L3 |
|---|---|---|
| Lundi-Vendredi 8h-19h | walilarabi (admin) | dev principal |
| Lundi-Vendredi 19h-8h | walilarabi (sur appel) | dev principal (sur appel critique) |
| Weekend | walilarabi (sur appel critique) | dev principal (critique uniquement) |
| Astreinte 24/7 sur incident critique | À documenter dans contrat pilote | À documenter |

---

## 9. Critères de réussite du pilote

### 9.1 Indicateurs mesurables (durée pilote = 8 semaines suggérées)

#### 🛡️ Sécurité

| KPI | Cible | Mesure |
|---|---|---|
| Fuites de données inter-hôtels | **0** | Audit `audit_logs` + sondes RLS hebdomadaires |
| Tentatives cross-tenant détectées et bloquées | Toutes loggées | `audit_logs WHERE 'cross_tenant_attempt'` |
| Compromission compte (login depuis IP inhabituelle) | **0** | `auth.audit_log_entries` analysis |
| Modifications frauduleuses facture émise | **0** | Vue `audit_alerts_invoice_financial_changes` (zéro tolérance) |

#### 💾 Intégrité données

| KPI | Cible |
|---|---|
| Pertes de réservation | 0 |
| Pertes de facturation | 0 |
| Doublons facture (`invoice_number`) | 0 (contrainte UNIQUE) |
| Surbookings constatés en exploitation | 0 (contrainte GiST) |
| Écart entre `audit_logs.invoice` et `invoices` (intégrité) | 0 ligne sans audit |

#### 🚀 Disponibilité & performance

| KPI | Cible |
|---|---|
| Uptime app (Vercel + Supabase) | > 99% (cible 99.5%) |
| Temps de chargement first paint p95 | < 3s |
| Erreurs frontend non gérées (Sentry crashRate) | < 0.5% des sessions |
| Erreurs Edge Function 5xx | < 1% des invocations |
| Délai réponse API p95 (PostgREST) | < 500 ms |

#### 😊 Adoption & satisfaction

| KPI | Cible |
|---|---|
| Nombre d'utilisateurs actifs hebdomadaires (WAU) | ≥ 80% des comptes invités |
| Workflows complétés sans escalade L3 | ≥ 90% |
| Score satisfaction utilisateur (enquête fin pilote, Likert 1-5) | ≥ 4 |
| NPS (recommanderiez-vous à un confrère hôtelier ?) | ≥ +30 |

#### 🛠️ Support

| KPI | Cible |
|---|---|
| Tickets 🔴 critiques résolus < 24h | 100% |
| Tickets 🟠 majeurs résolus < 3 j ouvrés | ≥ 90% |
| Tickets 🟡 mineurs traités < 2 semaines | ≥ 80% |
| Temps moyen de résolution (MTTR) | < 8h ouvrées |

### 9.2 Indicateurs de processus

- Au moins **1 retour hebdo** envoyé à la direction de l'hôtel
- Au moins **1 itération de correction** déployée par semaine sur les 8 semaines
- **Post-mortem documenté** pour chaque incident critique

---

## 10. Critères de sortie du pilote

À la fin du pilote (8 semaines), décision tripartite (CTO Flowtym + Direction hôtel + Direction projet).

### 10.1 ✅ GO COMMERCIALISATION (lancement public, vente à d'autres hôtels)

**Toutes ces conditions doivent être remplies** :

- 🛡️ 0 fuite de données démontrée, 0 modification frauduleuse de facture émise, 0 perte de données
- 💾 0 perte de réservation, 0 perte de facturation
- 🚀 Uptime ≥ 99% mesuré sur les 8 semaines
- 😊 Score satisfaction ≥ 4 / 5, NPS ≥ +30
- 🛠️ 100% tickets critiques résolus dans les délais
- 🔧 Chantiers Sprint 4 P1 livrés (trigger `protect_invoice_financials`, sécurisation séquences)
- 🔧 V12 `auth_leaked_password_protection` activée
- 🔧 Sentry en production
- 🔧 PRA testé au moins 1 fois (drill restoration backup)
- 🔧 Documentation utilisateur finale validée par la réception pilote
- 💰 Plan tarifaire commercial validé (pricing modèle SaaS)
- 📜 CGU/CGV/DPA juridiquement rédigés et validés

### 10.2 ⚠️ GO PILOTE ÉTENDU (2 à 5 hôtels supplémentaires, continuation du pilote 3 mois)

**Conditions intermédiaires** : pilote fonctionne sans incident critique, mais certains critères de commercialisation pas encore remplis.

- 🛡️ 0 fuite de données, 0 modification frauduleuse
- 💾 0 perte de réservation/facturation
- 🚀 Uptime ≥ 98%
- 😊 Score satisfaction ≥ 3.5 / 5
- 🛠️ Tickets critiques résolus mais SLA dépassés à l'occasion
- 🔧 Sprint 4 P1 en cours (au moins Plan A + B livrés)
- 🔧 V12 activée
- ❌ Pas encore : Sentry / docs finales / pricing commercial / juridique

Le pilote étendu sert à valider la scalabilité (3-5 hôtels en parallèle) et à finaliser les chantiers manquants.

### 10.3 ❌ NO GO (retour en développement)

**Au moins un de ces critères déclenche un NO GO** :

- 🔴 Fuite de données inter-hôtels avérée (incident sécurité critique)
- 🔴 Perte de réservation ou facturation > 1% des transactions
- 🔴 Uptime < 95%
- 🔴 Score satisfaction < 3 / 5 (rejet utilisateur)
- 🔴 Incident critique récurrent (> 2 / semaine) non résolu
- 🔴 Refus du commanditaire de signer une recommandation
- 🔴 Régression sécurité (Supabase Advisors ERROR > 0 réintroduits)

**Action NO GO** :
- Arrêt du pilote
- Rapport circonstancié post-mortem global
- Refonte des modules problématiques (sprint > 1 mois)
- Nouveau pilote avec un autre hôtel après corrections

---

## Annexes

### A. Glossaire opérationnel

| Sigle | Définition |
|---|---|
| RPO | Recovery Point Objective — perte de données maximale acceptable (en temps) |
| RTO | Recovery Time Objective — délai maximal pour restaurer le service |
| PRA | Plan de Reprise d'Activité |
| L1/L2/L3 | Niveaux de support (utilisateur, admin, dev) |
| MTTR | Mean Time To Resolution |
| WAU | Weekly Active Users |
| NPS | Net Promoter Score |
| SLA | Service Level Agreement |
| PITR | Point In Time Recovery (Supabase Pro) |
| FEC | Fichier des Écritures Comptables (Art. A47 A-1, France) |

### B. Référentiels documentaires existants

- `docs/AUDIT_LOGS_VS_RGPD.md` — audit/conformité RGPD
- `docs/CRM_BADGES_TAGS_FLAGS_SEGMENTS.md` — segmentation client
- `docs/L3_1_JOURNAL_360_*.md` — gouvernance journal unifié
- `docs/R4_GOUVERNANCE_DES_ROLES.md` — RBAC
- `docs/SCALING_PLAN.md` — plan de scale
- `docs/RMS_SUPABASE_INTEGRATION.md` — intégration RMS
- `docs/ops/V12-leaked-password-protection.md` — V12 toggle Auth

### C. Risques résiduels ouverts (hérités du rapport final consolidé)

Voir [`RAPPORT_FINAL_CONSOLIDATION` post-merge sprint-1/2/devops-1 dans l'historique des merges] — risques R1 à R9 documentés.

### D. Chantiers Sprint 4 référencés

- **Plan A** : `protect_invoice_financials` + RPC `register_payment` + machine d'états
- **Plan B** : sécurisation `next_invoice_number()`
- **Plan C** : sécurisation `next_contract_number()`
- **Plan D** : stratégie de tests (SQL régression + Vitest + Playwright + CI gate)
- **P2-A** : suppression mocks RMS
- **P2-B** : intégration Lighthouse réelle
- **P2-C** : MFA TOTP réel
- **P2-D** : Stripe réel

### E. Checklist J-7 avant lancement pilote

```text
[ ] Plan Supabase upgradé à Pro (PITR + SLA)
[ ] V12 auth_leaked_password_protection activée
[ ] MFA TOTP activé sur compte walilarabi (dashboard manuel)
[ ] 2e compte break-glass créé et stocké en coffre
[ ] Sentry DSN configuré dans Vercel env (si retenu)
[ ] UptimeRobot configuré sur URL prod
[ ] Canal Slack/WhatsApp #pilote-flowtym créé + membres ajoutés
[ ] Hôtel pilote provisionné (chambres, plans tarifaires, partenaires OTA)
[ ] Utilisateurs hôtel créés + rôles assignés
[ ] Formation réception J-3/J-2 terminée
[ ] Formation direction J-1 terminée
[ ] Test acceptation utilisateur réalisé sur 3 workflows critiques
[ ] PRA testé (1 restoration drill)
[ ] Documentation utilisateur PDF distribuée
[ ] Contrat pilote signé (SLA, données, durée, sortie)
[ ] Numéros support partagés à la direction de l'hôtel
[ ] Healthcheck pré-Go (Go/No-Go meeting)
```

### F. Checklist J0 — Lancement pilote

```text
[ ] Présence dev + admin sur place J0
[ ] Vérification que tous les utilisateurs peuvent se connecter
[ ] Test d'une 1ère vraie réservation en conditions réelles
[ ] Test d'un 1er check-in
[ ] Test d'un 1er paiement
[ ] Monitoring activé et observé en temps réel pendant la journée
[ ] Debrief fin J0 avec direction hôtel
[ ] Rapport quotidien jusqu'à J+7
```

---

## Décision

Ce document est un livrable contractuel entre Flowtym et l'hôtel pilote.

**Signataires recommandés** :
- CTO Flowtym
- Direction hôtel pilote
- Responsable réception pilote
- Responsable comptable pilote

**Révision** : avant chaque pilote suivant + post-pilote pour intégration retours.

---

**Fin du document**  
**Version 1.0** — 2026-06-18
