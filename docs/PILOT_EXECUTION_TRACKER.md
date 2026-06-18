# Pilot Execution Tracker — Folkestone Opéra

**Référence unique de suivi du pilote.**

---

## 📐 Règles de reporting (gravées)

Chaque mise à jour hebdomadaire contient **uniquement** ces 5 sections :

1. **Réalisé** — ce qui a été effectivement exécuté
2. **Bloquants** — ce qui empêche l'avancement
3. **Risques** — risques identifiés à court terme
4. **Semaine suivante** — actions prévues
5. **Date J0 estimée** — date réaliste du lancement pilote

Aucun contenu théorique. Aucun rapport stratégique. Aucune nouvelle roadmap.

---

## 🚦 3 priorités absolues bloquant J0

| # | Sujet | Statut |
|---|---|---|
| 1 | Email transactionnel opérationnel | ⏳ ouvert |
| 2 | Référent Folkestone officiellement désigné | ⏳ ouvert |
| 3 | TAU exécuté et validé (10/10 + signatures) | ⏳ ouvert |

**Tant qu'au moins un de ces 3 sujets reste ouvert : pilote NON lançable.**

---

## 📊 Tableau de bord des 8 priorités

| # | Priorité | Owner | Statut |
|---|---|---|---|
| 1 | V12 `auth_leaked_password_protection` | walilarabi | ⏳ |
| 2 | Supabase Pro + PITR | walilarabi | ⏳ |
| 3 | **Email transactionnel Folkestone** | walilarabi + direction | ⏳ |
| 4 | Sentry + UptimeRobot | walilarabi | ⏳ |
| 5 | Canal WhatsApp pilote | walilarabi + référent | ⏳ |
| 6 | **Référent Folkestone (D8)** | direction Folkestone | ⏳ |
| 7 | Supports formation | walilarabi | 🟡 skeletons livrés |
| 8 | **TAU exécuté + signé** | référent + walilarabi | ⏳ |

**Légende** : ⏳ à faire · 🟡 en cours · ✅ fait · 🛑 bloqué

---

## 📅 Suivi hebdomadaire

### Semaine 0 — 2026-06-18

**Réalisé**
- Merge sur `main` : sprint-1 + sprint-2 + devops-1 + 2 plans + checklist pilote + Sentry intégré + tracker
- HEAD `main` : `bf919c9`
- Skeletons formation Réception / Direction / RH publiés
- Protocole TAU 10 scénarios publié

**Bloquants**
- Aucun à ce stade côté Flowtym
- En attente exécution ops côté commanditaire (P1 à P6)

**Risques**
- P6 référent Folkestone : si non désigné en S1 → décalage immédiat J0
- P3 email : DNS DKIM Folkestone peut prendre > 24h selon registrar
- Décision D1 (date cible J0) non prise → impossible d'arbitrer les glissements

**Semaine suivante (S1)**
- Exécution attendue côté ops : P1 + P2 + P4
- Lancement P3 (création compte Resend)
- Identification P6 (référent)

**Date J0 estimée**
- À déterminer après décision D1 (date cible) et confirmation P3/P6
- Plus tôt réaliste : J0 = 4 semaines à compter de la fermeture de P6

---

### Template hebdo (à recopier vendredi prochain)

```
### Semaine X — YYYY-MM-DD

**Réalisé**
- ...

**Bloquants**
- ...

**Risques**
- ...

**Semaine suivante (S X+1)**
- ...

**Date J0 estimée**
- ...
```

---

## 📌 Détail actionnable par priorité

> Conservé pour référence ops. Pas mis à jour chaque semaine — uniquement quand statut change.

### P1 — V12 `auth_leaked_password_protection`

Dashboard Supabase → Auth → Providers → Email → toggle "Leaked password protection" ON.
Validation : tenter compte avec `password123` → refus attendu.

### P2 — Supabase Pro + PITR

Dashboard Supabase → Billing → Upgrade Pro ($25/mois).
Forcer snapshot manuel "Pre-pilot baseline" + drill restauration → mesurer RTO.

### P3 — Email transactionnel Folkestone (BLOQUANT)

1. Créer compte Resend
2. Vérifier domaine (DKIM + SPF DNS)
3. Récupérer API key
4. `supabase secrets set RESEND_API_KEY=re_xxx RESEND_FROM_EMAIL=... RESEND_FROM_NAME=...`
5. `bash scripts/deploy-security-sprint1-functions.sh hzrzkvdebaadditvbqis`
6. Settings UI Flowtym → Communication → activer email
7. Tests : reset password, confirmation résa, dispute SAS

### P4 — Sentry + UptimeRobot

Sentry : compte Team $26/mois → DSN → Vercel env `VITE_SENTRY_DSN` → redeploy → test erreur volontaire → vérifier RGPD (request/user/breadcrumbs).
UptimeRobot : compte free → monitor HTTP URL prod → alerte WhatsApp → test panne simulée.

### P5 — Canal WhatsApp pilote

Créer groupe "Flowtym Pilote Folkestone". Inviter walilarabi + direction + référent + backup astreinte.
Coller règlement incident (format Quoi/Quand/Qui + SLA 30min/2h/24h selon sévérité).

### P6 — Référent Folkestone (BLOQUANT)

Profil : direction ou chef réception, dispo 8h-19h sur 8 semaines, joignable WhatsApp.
À remplir avec direction Folkestone :

| Item | À remplir |
|---|---|
| Nom + Prénom | _____________ |
| Rôle | _____________ |
| Email pro | _____________ |
| WhatsApp | _____________ |
| Disponibilité | _____________ |
| Backup | _____________ |
| Date début mission | _____________ |
| Acceptation signée le | _____________ |

### P7 — Formation

Skeletons publiés sur `main` :
- `docs/training/RECEPTION_GUIDE.md`
- `docs/training/DIRECTION_GUIDE.md`
- `docs/training/RH_GUIDE.md`

À enrichir avec captures écran réelles en S-2 avant sessions.
Sessions : J-7 kickoff, J-5/J-4 réception (2×2h), J-3 direction (6h), J-2 RH (3h).

### P8 — TAU (BLOQUANT)

Protocole publié sur `main` : `docs/tau/TAU_PROTOCOL.md` (10 scénarios + tests négatifs).

Critère : 10/10 (ou 9/10 + scénario 10 SAS reporté si email pas prêt).
Signatures obligatoires : référent + direction + réception + RH + walilarabi.
Sans signatures complètes → pas de J0.

---

## 🆘 Incidents — log

| Date | Sévérité | Description | Résolution | MTTR |
|---|---|---|---|---|
| — | — | Aucun incident à ce jour | — | — |

---

## 📦 Décisions enregistrées (D1-D8)

| ID | Sujet | Décision |
|---|---|---|
| D1 | Date J0 | Non figée — lundi après validation complète prérequis |
| D2 | Durée pilote | 8 semaines |
| D3 | Périmètre | Complet (PMS, Résa, Clients, Facturation, Paiements, Revenue, RH, SAS) |
| D4 | Sentry | Option A — intégration minimale autorisée, mergée |
| D5 | Canal d'alerte | WhatsApp |
| D6 | Domaine custom | Différé — URL Vercel suffit |
| D7 | 2e superadmin break-glass | Compte distinct + MFA + traçage obligatoire |
| D8 | Référent Folkestone | À confirmer avant J-7 |

---

**Document vivant. Prochaine mise à jour : vendredi prochain.**

---

## 🚦 Priorité par priorité — actionnable

### P1 — V12 `auth_leaked_password_protection`

**Action ops** :
```
Dashboard Supabase → Authentication → Providers → Email → Settings
→ Toggle "Leaked password protection (HaveIBeenPwned)" : ON
→ Save
```

**Validation immédiate** (à exécuter par walilarabi après activation) :
1. Logout
2. Tenter de créer un compte test avec password `password123`
3. ✅ Refus attendu : `"Password is in a list of compromised passwords"`
4. Réessayer avec `Folkestone#2026-secure` → ✅ accepté

**Preuve à archiver** : capture d'écran du toggle ON + capture du refus password compromis.

---

### P2 — Supabase Pro + PITR

**Action ops** :
```
Dashboard Supabase → Project Settings → Billing → Upgrade to Pro
Coût : $25/mois
Confirmer le paiement (CB walilarabi)
```

**Validation post-upgrade** — exécuter cette query :

```sql
-- À copier dans Supabase SQL Editor une fois Pro activé
SELECT
  (SELECT current_setting('server_version') )                        AS pg_version,
  (SELECT count(*) FROM information_schema.tables
    WHERE table_schema='public')                                     AS public_tables,
  (SELECT pg_size_pretty(pg_database_size('postgres')))              AS db_size,
  current_timestamp                                                  AS check_at;
```

**Action obligatoire post-upgrade** :
1. Dashboard → Database → Backups → vérifier que **PITR est actif**
2. Forcer 1 snapshot manuel "Pre-pilot baseline" et noter la date
3. **Drill restauration** : créer un projet clone gratuit (Supabase autorise sur Pro), tester restauration sur les 24h passées, mesurer le RTO réel
4. Documenter le RTO mesuré dans ce tracker

**Politique de rétention** (par défaut Supabase Pro) :
- Snapshots quotidiens : 7 jours
- PITR : 7 jours (granularité seconde)

**Procédure de restauration** : voir `docs/PILOT_DEPLOYMENT_PLAN_v1.md` §2.4 (procédure C).

**À remplir post-drill** :
- PITR actif : [ ] confirmé
- RTO mesuré : __ minutes
- Snapshot pré-pilote : pris le __ à __h__
- Documenté dans : `docs/ops/RTO_MEASURE_FOLKESTONE.md` (à créer après drill)

---

### P3 — Email transactionnel Folkestone (BLOQUANT)

**Fournisseur recommandé** : **Resend**
- Coût : 100 emails/jour gratuit, $20/mois pour 50k emails
- Intégration native Supabase Edge Functions déjà en place
- Edge Function `send-email` patchée (V4 CORS allowlist + verify_jwt=true) prête côté code (pas encore déployée — `supabase functions deploy send-email` à exécuter via `scripts/deploy-security-sprint1-functions.sh`)

**Configuration côté Resend** :
```
[ ] 1. Créer compte sur https://resend.com
[ ] 2. Vérifier domaine d'envoi (Folkestone) :
       Domain : hotelfolkestoneopera.com (ou flowtym.com)
       Ajouter records DNS : SPF, DKIM (fournis par Resend)
       Attendre validation (<1h habituellement)
[ ] 3. Créer API Key (Settings → API Keys)
       Copier la clé (commence par re_...)
[ ] 4. Configurer dans Supabase Edge Functions secrets :
       supabase secrets set RESEND_API_KEY=re_xxx --project-ref hzrzkvdebaadditvbqis
       supabase secrets set RESEND_FROM_EMAIL=no-reply@<domaine vérifié>
       supabase secrets set RESEND_FROM_NAME="Folkestone Opéra"
[ ] 5. Déployer send-email (CORS allowlist + auth déjà patchés) :
       bash scripts/deploy-security-sprint1-functions.sh hzrzkvdebaadditvbqis
       (ce script déploie aussi send-whatsapp, trigger-backup, send-dispute-email
        si pas encore fait)
```

**Configuration côté Folkestone dans Flowtym UI** :
```
[ ] Settings → Communication → Email
[ ] Activer "Email transactionnel"
[ ] Provider : resend
[ ] From email : no-reply@<domaine vérifié>
[ ] From name : Folkestone Opéra
[ ] API key : (lue depuis Supabase secrets, pas saisie ici)
[ ] is_active : true
```

**Tests d'envoi** :
1. Reset password test : faire forgot password sur compte test → mail reçu ?
2. Email confirmation réservation test : créer 1 résa avec email valide → mail reçu ?
3. SAS dispute email test : créer 1 dispute test → "preview" puis "envoyer" → mail reçu ?

**Validation** : 3/3 emails reçus dans la boîte cible avec :
- ✅ Expéditeur "Folkestone Opéra <no-reply@...>"
- ✅ DKIM signature valide (vérifier en-têtes)
- ✅ Pas de classement spam (Gmail/Outlook)

---

### P4 — Observabilité (Sentry + UptimeRobot)

#### Sentry

```
[ ] 1. Créer compte sur https://sentry.io
[ ] 2. Créer organisation "Flowtym"
[ ] 3. Plan : Team ($26/mois, 50k errors/mois)
[ ] 4. Créer projet "flowtym-pms-frontend" (type React)
[ ] 5. Copier le DSN
[ ] 6. Vercel : Project Settings → Environment Variables
       Ajouter VITE_SENTRY_DSN = <DSN> (Production + Preview)
       Optionnel : VITE_APP_VERSION = <git short sha>
[ ] 7. Re-déployer (Vercel → Deployments → "Redeploy")
[ ] 8. Test : ouvrir l'app prod, taper en console :
       throw new Error('Sentry RGPD test 2026-06-18')
[ ] 9. Vérifier dashboard Sentry : event reçu sous 30 sec
[ ] 10. VÉRIFIER RGPD sur cet event :
        - request.url : query params redactés ✅
        - user : null ou tags génériques uniquement ✅
        - breadcrumbs : 0 console, 0 body fetch ✅
        - request.headers : pas de Authorization ✅
        - environment : "production" ✅
```

**Preuve à archiver** : capture du dashboard Sentry avec l'event de test + zoom sur les champs sensibles montrant qu'ils sont vides/redactés.

#### UptimeRobot

```
[ ] 1. Créer compte gratuit sur https://uptimerobot.com
[ ] 2. + New Monitor :
       Monitor Type : HTTP(s)
       Friendly Name : "Flowtym Folkestone PROD"
       URL : https://<URL Vercel prod>
       Monitoring Interval : 5 minutes
[ ] 3. Alert Contacts → Add :
       Type : WhatsApp Web (via Pro Alert ou webhook custom)
       OU : SMS (compte payant)
       OU : Email puis relayé manuellement
[ ] 4. Test simulé :
       - Arrêter momentanément le déploiement Vercel (Settings → Domains → Disable)
       - Attendre l'alerte (5-7 min)
       - Réactiver
       - Vérifier que la notif a bien été reçue dans le canal pilote
[ ] 5. Documenter l'URL du status page public dans le canal pilote
```

---

### P5 — Canal WhatsApp pilote

```
[ ] 1. Créer groupe WhatsApp "Flowtym Pilote Folkestone"
[ ] 2. Inviter :
       - walilarabi (admin Flowtym)
       - Direction Folkestone (à confirmer numéro)
       - Référent Folkestone (D8 — voir P6)
       - 1 backup astreinte
[ ] 3. Épingler en haut du groupe :
       - Numéros support (L1/L2/L3)
       - URL UptimeRobot status page
       - Procédure d'incident (voir template ci-dessous)
[ ] 4. Faire 1 message de test "Bienvenue pilote, 1er incident reproduit
       sera traité en < 30 min en heures ouvrées"
```

**Procédure d'incident à coller en règlement du groupe** :
```
🆘 INCIDENT DÉTECTÉ — workflow :

1. Décrire en 3 lignes :
   - Quoi : "<symptôme observé>"
   - Quand : "<heure>"
   - Qui : "<utilisateur impacté>"
2. Capture d'écran si possible
3. Sévérité estimée : 🔴 critique / 🟠 majeur / 🟡 mineur

Acks attendus :
- 🔴 critique : 30 min (ouvré) / 2h (24/7)
- 🟠 majeur : 2h (ouvré)
- 🟡 mineur : 1 jour (ouvré)

L2 (walilarabi) accuse réception, diagnostique, escalade L3 si besoin.
Communication user sous 1h en cas critique.
```

---

### P6 — Référent Folkestone (BLOQUANT)

**Profil recherché** :
- Personne de la direction OU adjoint direction OU chef réception
- Disponible **8h-19h** sur le pilote (8 semaines)
- Capable de centraliser les retours réception + direction + RH
- Joignable WhatsApp
- Anglais ou français OK

**Grille à remplir** (par walilarabi avec direction Folkestone) :

| Item | À remplir |
|---|---|
| Nom + Prénom | _________________ |
| Rôle Folkestone | _________________ |
| Email pro | _________________ |
| Téléphone / WhatsApp | _________________ |
| Disponibilité (jours/horaires) | _________________ |
| Backup (si absent congé) | _________________ |
| Date début mission | _________________ |
| Acceptation écrite | [ ] signée le ___ |

**Responsabilités du référent (à briefer au début)** :
1. Centraliser tous les retours utilisateurs pendant le pilote
2. Trier les tickets par sévérité avant escalade vers walilarabi (L2)
3. Animer une revue interne hebdomadaire (15 min vendredi)
4. Représenter le pilote en réunion bilatérale Flowtym hebdo
5. Valider les TAU avant lancement
6. Co-signer le bilan pilote (post 8 semaines)

---

### P7 — Formation (skeletons en cours)

Préparé sur cette branche (livrables ci-dessous), à enrichir avec captures écrans après accès UI :
- `docs/training/RECEPTION_GUIDE.md` (5 workflows en 1 page chacun)
- `docs/training/DIRECTION_GUIDE.md` (3 workflows)
- `docs/training/RH_GUIDE.md` (4 workflows)

**À compléter avant J-7** :
- [ ] Captures écran réelles annotées (à faire après J-21 quand Folkestone est nettoyé + opérationnel)
- [ ] 6 vidéos courtes (3 min max chacune) : à enregistrer en démo live
- [ ] Aide-mémoire 1 page A4 plastifiable (à imprimer)
- [ ] Sessions de formation planifiées avec direction Folkestone

---

### P8 — TAU (Test d'Acceptation Utilisateur) — BLOQUANT

Protocole détaillé : `docs/tau/TAU_PROTOCOL.md` (livré sur cette branche).

**10 scénarios obligatoires, exécutés par 2 personnes :**
1. Login + navigation
2. Création réservation walk-in
3. Modification réservation (dates + chambre)
4. Check-in + check-out complet avec facture + paiement
5. Recherche client + consultation historique
6. Création employé + ajout contrat
7. Demande absence + approbation
8. Pointage QR
9. Consultation dashboard Revenue mensuel
10. Création dispute SAS + envoi email (si email actif)

**Critère de validation** : 10/10 scénarios passent sans intervention support.

**Signature obligatoire** :
- Référent Folkestone (P6) : signature électronique ou paraphe
- walilarabi (CTO) : signature électronique ou paraphe

**Sans signature TAU = pas de J0**.

---

## 📅 Calendrier prévisionnel J-X

| Période | Activité bloquante | Statut |
|---|---|---|
| J-28 à J-21 | P1 + P2 + P6 + début P3 | ⏳ |
| J-21 à J-14 | Fin P3 + P4 + P5 | ⏳ |
| J-14 à J-7 | P7 (formation) + setup utilisateurs Folkestone | ⏳ |
| J-7 à J-3 | Sessions formation (réception, direction, RH) | ⏳ |
| J-3 | TAU 10 scénarios + signatures | ⏳ |
| J-1 | Go/No-Go meeting avec direction | ⏳ |
| **J0 (lundi)** | 🚀 Lancement pilote | ⏳ |

**Décision finale J0 = quand toutes les 8 priorités sont au statut ✅.**

---

## 📈 Suivi hebdomadaire

### Semaine 0 (cette semaine) — bilan

**Réalisé** :
- ✅ Tracker créé et publié
- ✅ Skeletons formation Réception/Direction/RH livrés
- ✅ Protocole TAU livré
- ✅ Templates incident WhatsApp prêts

**Blocages** :
- Aucun blocage technique
- Attente : décisions ops côté walilarabi (P1 à P5) + désignation référent (P6)

**Risques semaine** :
- Si P6 (référent) prend plus de 7 jours à se confirmer → glissement J0 d'autant
- Si DKIM email DNS prend > 2 jours côté provider DNS Folkestone → idem

**Prévision S+1** :
- P1, P2, P4 (Sentry + UptimeRobot) bouclés
- P3 (Email) lancé, attente DKIM validation
- P6 (référent) confirmé

### Semaine 1 — à remplir vendredi prochain

```
Réalisé S1 :
 - [ ] P1
 - [ ] P2
 - [ ] P4 Sentry
 - [ ] P4 UptimeRobot
 - [ ] P3 lancé (Resend account)
 - [ ] P6 référent confirmé

Blocages S1 :
 - _____________

Risques S2 :
 - _____________

Prévision S+2 :
 - _____________
```

### Template hebdo (à recopier semaine après semaine)

```
### Semaine X — bilan

Réalisé : (lister actions du tracker passées à ✅)
Blocages : (lister obstacles)
Risques : (lister ce qui peut déraper)
Prévision S+1 : (actions du tracker visées pour la semaine suivante)
Date J0 estimée à ce stade : _____
```

---

## 🚨 Indicateurs de santé pilote

| Métrique | Vert | Orange | Rouge |
|---|---|---|---|
| Glissement J0 | < 1 semaine | 1-2 semaines | > 2 semaines |
| Priorités bloquées | 0 | 1 | ≥ 2 |
| P3/P6/P8 (bloquants) | tous ⏳ ou ✅ | 1 🛑 | ≥ 2 🛑 |
| Blocages externes (DNS, fournisseur) | 0 | 1 | ≥ 2 |

État actuel : 🟡 **vigilance normale** — P3/P6 à débloquer S+1.

---

## 📌 Gel produit — rappel

Autorisés en S0-S? : configuration, observabilité, monitoring, documentation, formation, **correctifs bugs critiques seulement**.

Interdits : nouveaux développements, Sprint 4 comptable, Lighthouse, Stripe, MFA généralisé, refontes.

**Exception active** : Sentry intégration minimale (déjà mergée).

---

**Document vivant. Mise à jour : chaque vendredi.**  
**Prochain owner update : 2026-06-25 (S1)**.
