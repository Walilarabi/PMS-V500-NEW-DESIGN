# Checklist opérationnelle de lancement pilote — Folkestone Opéra

**Version** : 1.0  
**Date** : 2026-06-18  
**Pilote cible** : **Folkestone Opéra**  
**État système** : `main` HEAD `51af7d3` (post-merge plan pilote v1 + plan sprint-4 différé)

---

## Préambule

Document opérationnel **actionnable** consolidant les 5 priorités validées par le commanditaire pour le lancement du pilote.

**Principe** : aucun développement applicatif. Uniquement actions ops, configuration externe, formation et lancement.

**Cible date pilote J0** : à confirmer (proposition : 4 semaines après validation de cette checklist).

---

## Sommaire

1. [Priorité 1 — Activation `auth_leaked_password_protection`](#priorité-1--activation-auth_leaked_password_protection)
2. [Priorité 2 — Monitoring pilote](#priorité-2--monitoring-pilote)
3. [Priorité 3 — Préparation Folkestone Opéra](#priorité-3--préparation-folkestone-opéra)
4. [Priorité 4 — Formation utilisateurs](#priorité-4--formation-utilisateurs)
5. [Priorité 5 — Lancement du pilote](#priorité-5--lancement-du-pilote)
6. [Calendrier prévisionnel](#calendrier-prévisionnel)
7. [Décisions opérationnelles à prendre](#décisions-opérationnelles-à-prendre)

---

## Priorité 1 — Activation `auth_leaked_password_protection`

### Objectif

Activer la vérification HaveIBeenPwned sur les mots de passe Supabase Auth → refus de tout mot de passe connu dans une fuite publique.

### Effort

**5 minutes** sur le dashboard Supabase.

### Procédure

```text
[ ] 1. Se connecter au dashboard Supabase
       URL : https://supabase.com/dashboard/project/hzrzkvdebaadditvbqis
[ ] 2. Naviguer : Authentication → Providers → Email
[ ] 3. Section "Password security"
[ ] 4. Activer le toggle "Leaked password protection (HaveIBeenPwned)"
[ ] 5. Sauvegarder
[ ] 6. Vérifier via test :
        - Tenter de créer un compte avec password "password123"
        - Doit être refusé avec message "Compromised password"
[ ] 7. Documenter la date d'activation dans audit interne
```

### Validation

```text
[ ] Test compte avec mot de passe compromis → refusé
[ ] Test compte avec mot de passe fort → accepté
[ ] Capture d'écran sauvegardée dans docs/ops/
```

### Référence interne

Voir document préexistant : `docs/ops/V12-leaked-password-protection.md`.

### Responsable

Admin Supabase (walilarabi@gmail.com)

### Délai recommandé

**Immédiat** — à faire avant toute autre étape pilote.

---

## Priorité 2 — Monitoring pilote

### 2.1 Sentry

#### Choix du plan

| Plan | Coût | Capacité | Adapté pilote ? |
|---|---|---|---|
| Developer (Free) | $0 | 5k erreurs/mois, 1 user, 30 j rétention | ⚠️ Limite si pic d'erreurs en début pilote |
| **Team** (recommandé) | **$26/mois** | 50k erreurs/mois, illimités users, 90 j rétention | ✅ Optimal pilote 1-2 hôtels |
| Business | $80/mois | 250k erreurs/mois + APM + alerting avancé | ⏸ Surdimensionné pilote |

**Recommandation** : Plan Team (~$26/mois pendant le pilote, downgrade possible si volume faible).

#### Procédure de mise en place

```text
[ ] 1. Créer compte Sentry sur https://sentry.io
[ ] 2. Créer organisation "Flowtym"
[ ] 3. Créer projet "flowtym-pms-frontend" (type React)
[ ] 4. Récupérer DSN (Settings → Projects → Client Keys)
[ ] 5. Configurer DSN dans Vercel :
        - Vercel Dashboard → Project Flowtym → Settings → Environment Variables
        - Ajouter : VITE_SENTRY_DSN = <DSN copié>
        - Ajouter : VITE_APP_VERSION = <git sha court>
        - Environments : Production + Preview
[ ] 6. Installer la dépendance frontend (avant déploiement) :
        npm install --save @sentry/browser
[ ] 7. Activer dans main.tsx (code à ajouter — minime, voir below)
[ ] 8. Re-déployer Vercel
[ ] 9. Tester en provoquant 1 erreur volontaire (ex : window.__triggerTestError = () => { throw new Error('Sentry test') })
[ ] 10. Vérifier réception dans Sentry dashboard
```

#### Code d'intégration (NON DEV — juste référence pour activation post-pilote)

Module `installSentry()` déjà créé dans `frontend/src/lib/observability.ts` (devops-sprint-1).
Activation dans `main.tsx` = **3 lignes** :

```typescript
if (import.meta.env.VITE_SENTRY_DSN) {
  const Sentry = await import('@sentry/browser');
  installSentry(Sentry, import.meta.env.VITE_SENTRY_DSN);
}
```

⚠️ **Note** : ces 3 lignes sont du développement applicatif et nécessitent ton autorisation explicite avant ajout au code. Sans ces 3 lignes, le DSN configuré dans Vercel reste inerte côté frontend. **Décision attendue** : autoriser l'ajout de ces 3 lignes en exception au gel produit, OU décider de différer Sentry post-pilote.

#### Alternative sans dev : Vercel Speed Insights / Analytics

Vercel propose nativement :
- **Web Analytics** (gratuit) : page views, performance
- **Speed Insights** ($10/mois) : Core Web Vitals

Ne capture pas les erreurs JavaScript runtime mais permet un démarrage 0-code. À activer sur Vercel Dashboard → Analytics.

### 2.2 UptimeRobot

#### Procédure

```text
[ ] 1. Créer compte sur https://uptimerobot.com (Free plan : 50 monitors)
[ ] 2. Créer monitor :
        - Type : HTTP(s)
        - Friendly Name : "Flowtym Pilote Folkestone"
        - URL : https://<URL Vercel prod ou domaine custom>
        - Monitoring Interval : 5 min
[ ] 3. Configurer notifications :
        - Email (admin)
        - Webhook Slack (si Slack actif)
        - SMS (compte payant) ou WhatsApp via Pro Alert
[ ] 4. Tester en arrêtant temporairement le déploiement Vercel
[ ] 5. Documenter l'URL du dashboard public dans la doc ops
```

#### Validation

```text
[ ] Monitor "OK" pendant 24h consécutives
[ ] Notification reçue lors d'un test de panne simulée
[ ] Status public partageable avec le pilote
```

### 2.3 Canal d'alerte

#### Option A — Slack (recommandé si équipe étendue)

```text
[ ] 1. Créer workspace "Flowtym" sur Slack (si pas existant)
[ ] 2. Créer canal #pilote-folkestone
[ ] 3. Inviter :
        - walilarabi (admin)
        - Référent hôtel Folkestone
        - Développeur principal
[ ] 4. Brancher Sentry → Slack (Sentry Settings → Integrations → Slack)
[ ] 5. Brancher UptimeRobot → Slack (UptimeRobot My Settings → Alert Contacts → Slack webhook)
[ ] 6. Tester en provoquant 1 alerte
```

#### Option B — WhatsApp (recommandé si équipe restreinte locale)

```text
[ ] 1. Créer groupe WhatsApp "Pilote Folkestone"
[ ] 2. Inviter mêmes membres
[ ] 3. UptimeRobot → SMS ou Email → relayé manuellement vers groupe
[ ] 4. Pas d'intégration native Sentry → notification email reçue puis relayée
```

#### Validation

```text
[ ] Canal créé et membres ajoutés
[ ] Au moins 1 alerte test reçue par tous
[ ] Procédure de prise en charge documentée (qui répond, sous quel délai)
```

### 2.4 Tableau de bord pilote (lecture SQL hebdomadaire)

À consulter chaque lundi par l'admin :

```sql
-- À exécuter dans Supabase SQL Editor
SELECT
  (SELECT COUNT(*) FROM public.reservations WHERE created_at > now() - interval '7 days') AS reservations_7d,
  (SELECT COUNT(*) FROM public.invoices WHERE created_at > now() - interval '7 days')     AS invoices_7d,
  (SELECT COUNT(*) FROM public.payments WHERE status='failed' AND created_at > now() - interval '7 days') AS payments_failed_7d,
  (SELECT COUNT(*) FROM public.audit_logs
   WHERE entity='invoice' AND action='updated'
     AND payload->'diff' ?| array['total_ttc','total_ht','total_tva','paid_amount']
     AND created_at > now() - interval '7 days') AS suspect_invoice_modifs_7d,
  (SELECT COUNT(*) FROM auth.audit_log_entries
   WHERE payload->>'action' IN ('login_failed','login_invalid_credentials')
     AND created_at > now() - interval '7 days') AS auth_failures_7d;
```

Documenter les seuils d'alerte (ex : `suspect_invoice_modifs_7d > 0` → enquête).

---

## Priorité 3 — Préparation Folkestone Opéra

### 3.1 Audit de l'environnement actuel

Folkestone Opéra existe déjà en prod (`hotel_id = 02b9eb0e-89ef-45de-ba8e-20d4b41c500c`). Données actuelles confirmées hands-on Phase 4 :

| Élément | Quantité | Statut |
|---|---|---|
| Chambres | (à confirmer) | ✅ Configurées |
| Réservations | 355 (historiques) | ✅ Existantes |
| Factures | 13 | ✅ |
| Paiements | À confirmer | ✅ |
| Guests | 276 | ✅ |
| Employés | 19 | ✅ |
| Partenaires OTA | (à confirmer Booking/Airbnb/Direct) | ✅ |
| Disputes SAS | 0 | n/a |

### 3.2 Checklist de pré-flight

```text
[ ] 1. Confirmer avec la direction Folkestone :
       - Date cible J0 du pilote
       - Périmètre (modules : PMS / Revenue / SAS / RH / tous)
       - Durée du pilote (recommandation : 8 semaines)
       - Nombre d'utilisateurs à former

[ ] 2. Audit configuration hôtel :
       [ ] Chambres : nombre, types, plans tarifaires associés
       [ ] Plans tarifaires : BAR, NRF, packages — actifs et cohérents
       [ ] Partenaires OTA : Booking.com, Expedia, Airbnb, Direct configurés
       [ ] Email transactionnel : adresse "no-reply@..." configurée
       [ ] Paramètres facturation : TVA hôtel, numérotation, mentions légales
       [ ] Politique d'annulation paramétrée

[ ] 3. Nettoyage données test (si présentes) :
       [ ] Suppression résa de test
       [ ] Suppression factures de test (status='draft' uniquement)
       [ ] Suppression users __pentest_ (confirmés supprimés Phase 4)

[ ] 4. Création des comptes utilisateurs réels :
       [ ] Liste des utilisateurs à inviter (avec rôles)
       [ ] Invitations envoyées via Edge Function `invite-user`
       [ ] Premier login testé pour chaque user
       [ ] Mots de passe forts vérifiés (auth_leaked_password_protection actif)

[ ] 5. Configuration superadmin break-glass :
       [ ] 2e compte superadmin créé (en plus de walilarabi)
       [ ] Stocké dans coffre-fort (1Password, Bitwarden ou équivalent)
       [ ] MFA TOTP activé sur le compte break-glass
       [ ] Procédure d'usage documentée (uniquement en cas de perte accès walilarabi)

[ ] 6. Backup Supabase :
       [ ] Plan Pro activé (PITR 7 jours)
       [ ] Snapshot manuel forcé avant J0 (point de référence)
       [ ] Test de restauration sur projet clone effectué

[ ] 7. Domaine custom (optionnel mais recommandé) :
       [ ] Sous-domaine choisi : ex flowtym.folkestone-hotel.fr
       [ ] DNS configurés (CNAME vers Vercel)
       [ ] Certificat HTTPS validé automatiquement par Vercel
       [ ] URL communiquée à l'hôtel pilote

[ ] 8. Documents légaux :
       [ ] Contrat pilote signé (SLA, périmètre, durée, sortie, RGPD)
       [ ] DPA (Data Processing Agreement) signée
       [ ] Mention sur la conservation des données et l'export RGPD
```

### 3.3 Test acceptation utilisateur (TAU)

À organiser **J-3 avant lancement** avec 1 personne de la réception + 1 personne de la direction :

```text
[ ] Scénario 1 : créer une réservation walk-in pour ce soir
[ ] Scénario 2 : check-in d'une réservation existante
[ ] Scénario 3 : encaisser un paiement et émettre une facture
[ ] Scénario 4 : check-out avec demande de paiement
[ ] Scénario 5 : créer un employé et lui ajouter un contrat
[ ] Scénario 6 : consulter le dashboard Revenue du mois précédent
[ ] Scénario 7 : modifier une réservation et noter une demande spéciale
[ ] Scénario 8 : recherche client par nom puis affichage historique
```

Chaque scénario doit être réalisable sans intervention support.

---

## Priorité 4 — Formation utilisateurs

### 4.1 Profils à former

| Profil | Personnes pilote | Durée | Format |
|---|---|---|---|
| Réception | 2-4 personnes | 4h × 2 sessions | Live + support PDF |
| Direction | 1-2 personnes | 6h × 1 session | Live |
| RH (si applicable) | 1 personne | 3h × 1 session | Live |

### 4.2 Supports à préparer (avant J-7)

```text
[ ] Mode d'emploi PDF réception (cible 30 pages, captures écrans annotées)
       - Login + sidebar
       - Création résa (avec cas spéciaux)
       - Check-in / check-out
       - Facturation
       - Paiements
       - Recherche client
       - FAQ + numéros support

[ ] Mode d'emploi PDF direction (cible 20 pages)
       - Vue d'ensemble + reporting
       - Revenue / RMS
       - Settings hôtel
       - Gestion utilisateurs

[ ] Mode d'emploi PDF RH (cible 15 pages)
       - Création employé / contrat
       - Planning + absences
       - Portail salarié

[ ] Captures vidéo courtes (< 3 min chacune) — à enregistrer en démo :
       1. Login + interface
       2. Création résa standard
       3. Check-in
       4. Facturation + paiement
       5. Check-out
       6. Cas spéciaux (surbooking, changement chambre, no-show)

[ ] Aide-mémoire 1 page A4 plastifiable :
       - 10 raccourcis clavier
       - Workflow réservation
       - Workflow facturation
       - Numéros support
```

### 4.3 Planification des sessions

| J-X | Session |
|---|---|
| J-7 | Kickoff direction (1h) — alignement objectifs + démo générale |
| J-5 | Formation Réception session 1 (modules 1-5, 2h) |
| J-4 | Formation Réception session 2 (modules 6-10, 2h) |
| J-3 | Formation Direction (6h en bloc ou 2 sessions de 3h) |
| J-2 | Formation RH (3h) |
| J-2 | Test acceptation utilisateur (TAU) — voir §3.3 |
| J-1 | Q&A + réponses à dernières questions + go/no-go |

### 4.4 Validation formation

```text
[ ] Chaque utilisateur a réalisé au moins 1 scénario complet en autonomie
[ ] Feedback formation collecté (formulaire court)
[ ] Liste de questions reçues consolidée dans une FAQ
[ ] Numéros support partagés à tous (L2 admin, escalade dev)
```

---

## Priorité 5 — Lancement du pilote

### 5.1 Checklist J-7 (semaine avant lancement)

Récupérée du `PILOT_DEPLOYMENT_PLAN_v1.md` annexe E :

```text
[ ] Plan Supabase upgradé à Pro (PITR + SLA)
[ ] V12 auth_leaked_password_protection activée
[ ] MFA TOTP activé sur compte walilarabi (dashboard manuel)
[ ] 2e compte break-glass créé et stocké en coffre
[ ] Sentry DSN configuré dans Vercel env (si retenu)
[ ] UptimeRobot configuré sur URL prod
[ ] Canal Slack/WhatsApp #pilote-folkestone créé + membres ajoutés
[ ] Folkestone provisionné (chambres, plans tarifaires, partenaires OTA)
[ ] Utilisateurs hôtel créés + rôles assignés
[ ] Formation réception terminée
[ ] Formation direction terminée
[ ] Test acceptation utilisateur réalisé sur 8 scénarios critiques
[ ] PRA testé (1 restoration drill sur projet clone)
[ ] Documentation utilisateur PDF distribuée
[ ] Contrat pilote signé (SLA, données, durée, sortie)
[ ] Numéros support partagés à la direction de l'hôtel
[ ] Healthcheck pré-Go (réunion Go/No-Go meeting)
```

### 5.2 Checklist J0 — Lancement pilote

```text
[ ] Présence dev + admin sur site J0 (8h-18h)
[ ] Vérification que tous les utilisateurs peuvent se connecter
[ ] Test d'une 1ère vraie réservation en conditions réelles
[ ] Test d'un 1er check-in
[ ] Test d'un 1er paiement
[ ] Test d'un 1er check-out
[ ] Monitoring activé et observé en temps réel (Sentry + UptimeRobot)
[ ] Briefing fin J0 avec direction hôtel
[ ] Rapport quotidien jusqu'à J+7
```

### 5.3 Checklist J+1 à J+7 (semaine de stabilisation rapprochée)

```text
[ ] J+1 : standup 9h + 17h, debriefing erreurs / questions / suggestions
[ ] J+2 : standup quotidien, hotfix si bug critique
[ ] J+3 : revue avec direction hôtel, ajustements
[ ] J+4 : standup
[ ] J+5 : revue hebdomadaire + bilan première semaine
[ ] J+6 : repos relatif, astreinte critique
[ ] J+7 : début routine hebdo (réunion vendredi 30 min)
```

### 5.4 Critères Go / No-Go J-1

Réunion **Go/No-Go** J-1 avec direction Folkestone :

| Critère | Statut |
|---|---|
| Tous les utilisateurs ont leur accès | ✅ requis |
| Formation complétée avec satisfaction ≥ 3/5 | ✅ requis |
| TAU 8 scénarios passés | ✅ requis |
| PRA testé | ✅ requis |
| Monitoring actif et vérifié | ✅ requis |
| Contrat signé | ✅ requis |
| Personnel hôtelier en place pour J0-J7 | ✅ requis |
| Backup snapshot pré-pilote pris | ✅ requis |

**Décision** : Go pilote / Report J+7 / No-Go définitif.

---

## Calendrier prévisionnel

Hypothèse de validation du commanditaire : J = aujourd'hui.

| Période | Activité |
|---|---|
| **Semaine 1** | Priorité 1 (V12) + début Priorité 2 (création comptes Sentry, UptimeRobot, canal) |
| **Semaine 2** | Fin Priorité 2 (configuration + tests monitoring) + début Priorité 3 (audit Folkestone) |
| **Semaine 3** | Fin Priorité 3 (provisioning, comptes, contrat) + début Priorité 4 (préparation supports) |
| **Semaine 4** | Priorité 4 (formations utilisateurs) + Priorité 5 (J-7 checklist) |
| **J0 (lundi semaine 5)** | Lancement pilote 🚀 |
| **Semaines 5-12** | Pilote 8 semaines avec revues hebdo |
| **Semaine 13** | Bilan pilote + décision GO COMMERCIALISATION / GO ÉTENDU / NO GO |

### Délais cibles modulables

- **Si Folkestone disponible plus tôt** : compression possible à 3 semaines de préparation
- **Si retards (vacances, etc.)** : extension possible à 6 semaines
- **Critique** : ne pas démarrer le pilote sans formation complète + TAU + monitoring actif

---

## Décisions opérationnelles à prendre

### Décisions immédiates (avant lancement Priorité 1)

```text
[ ] D1 — Date cible J0 du pilote : __________
[ ] D2 — Durée du pilote : 8 semaines (recommandé) / autre : __________
[ ] D3 — Périmètre modules : tous (recommandé) / partiel : __________
[ ] D4 — Plan Sentry : Team $26/mois (recommandé) / différé
[ ] D5 — Canal d'alerte : Slack (recommandé) / WhatsApp / autre : __________
[ ] D6 — Domaine custom : oui (recommandé) / vercel.app suffit
[ ] D7 — 2e compte superadmin break-glass : email = __________
[ ] D8 — Référent Folkestone côté hôtel : nom = __________
```

### Décisions différées (sprint suivant)

```text
[ ] D9 — Sprint 4 sécurisation comptable — réactivation après combien de semaines de pilote ?
[ ] D10 — Pilote étendu Washington Opéra — délai ?
[ ] D11 — Achat licence Sentry Business si volume justifie ?
[ ] D12 — Lighthouse / MFA / Stripe — ordre de priorité post-pilote ?
```

### Exception au gel produit — Sentry intégration

Voir [Priorité 2 / Sentry / Code d'intégration](#code-dintégration-non-dev--juste-référence-pour-activation-post-pilote).

L'activation effective de Sentry nécessite **3 lignes de code** dans `main.tsx` qui ne sont pas dans le gel produit actuel. Deux options :

**Option A** : Autoriser ces 3 lignes en exception au gel produit (intervention catégorie "observabilité" autorisée par Phase 4 du plan stratégique). Effort : 30 min, déploiement automatique Vercel.

**Option B** : Différer Sentry au sprint post-pilote. Pendant le pilote, s'appuyer sur :
- Vercel Web Analytics (activable sans code)
- Module `observability.ts` côté client avec ring buffer 100 events sur `window.__flowtymErrors` (utilisable en debug via console)
- Supabase Dashboard Logs (DB + Edge Functions)
- UptimeRobot (disponibilité)

**Recommandation** : **Option A** — l'observabilité erreurs est trop importante pour un pilote pour s'en passer. 3 lignes de code = exception justifiée.

---

## État de l'art à J0

| Domaine | Couverture |
|---|---|
| 🛡️ Sécurité multi-tenant | ✅ Validée hands-on (52 tests Phase 4) |
| 🔐 Authentification | ✅ JWT + RLS + audit append-only |
| 💰 Comptabilité | ⚠️ Soft control (audit trail) — Sprint 4 différé post-pilote |
| 📊 Revenue Management | ✅ 89/89 tests verts, recos > 0 prouvées |
| 👥 RH | ✅ Workflow bout-en-bout testé |
| 🤝 SAS / OTA Dispute | ✅ Edge Function v1 verify_jwt=true |
| 🚦 Monitoring | ⚠️ À configurer (cette checklist) |
| 💾 Sauvegarde | ⚠️ À upgrader Pro (PITR) |
| 📚 Documentation | ✅ Plan pilote + plan sprint-4 + checklist |
| 🧑‍🏫 Formation | ❌ À préparer (cette checklist) |

---

## Annexes

### A. Coûts mensuels estimés pendant pilote

| Poste | Coût mensuel | Optionnel ? |
|---|---|---|
| Supabase Pro | $25 | ✅ Validé |
| Sentry Team | $26 | ✅ Validé |
| Vercel Pro (si besoin domaines/equipes) | $0 (Hobby suffit) à $20 | ⚠️ Hobby OK pour pilote |
| Resend (50k emails) | $20 | ⚠️ Selon volume |
| UptimeRobot Pro | $0 (Free 50 monitors suffit) | ✅ Free OK |
| **Total ops minimum** | **~$51/mois** | |
| **Total avec emails** | **~$71/mois** | |

### B. Personnes clés du pilote

| Rôle | Personne | Contact |
|---|---|---|
| CTO Flowtym | walilarabi | walilarabi@gmail.com |
| Admin technique | walilarabi (superadmin) | idem |
| Référent hôtelier | À définir (D8) | À définir |
| Backup superadmin | À définir (D7) | À définir |
| Support L1 | Réception Folkestone | À définir |
| Support L2 | walilarabi | idem |
| Support L3 | Dev principal | À définir |

### C. Documents liés

- `docs/PILOT_DEPLOYMENT_PLAN_v1.md` — plan stratégique complet
- `docs/SPRINT_4_ACCOUNTING_SECURITY_PLAN.md` — plan sécurisation comptable (différé)
- `docs/ops/V12-leaked-password-protection.md` — procédure V12

---

**Fin du document**  
**Version 1.0** — 2026-06-18  
**Aucune action de développement applicatif — seulement actions ops et formation**
