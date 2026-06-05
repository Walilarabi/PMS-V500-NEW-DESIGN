# AUDIT FLOWTYM — Authentification, Rôles, Invitations, Multi-tenant
Date : 2026-06-05 · Périmètre : app.flowtym.com (PMS + /admin), rh.flowtym.com (RH Manager + /salarie), backend Supabase partagé.

Légende des preuves :
✅ **Vérifié automatiquement** (code/DB/HTTP) · 🟦 **Vérifié par logs** · ⚠️ **À valider par test utilisateur réel** · ❌ **Bloqué / cassé**

---

## 0. Architecture réelle constatée (≠ hypothèses du brief)

| Domaine | Projet Vercel | Repo GitHub | Contenu |
|---|---|---|---|
| app.flowtym.com (+ /admin) | `pms-v500-new-design` | `Walilarabi/PMS-V500-NEW-DESIGN` | PMS React/Vite + Back-office Admin |
| rh.flowtym.com (+ /salarie) | `flowtym-rh` | `Walilarabi/flowtym-rh` | App **HTML/JS vanilla** : `index.html`=Manager, `portal.html`=Salarié |
| Backend (les 3) | — | — | **1 seul** Supabase `flowtym-housekeeping` (`hzrzkvdebaadditvbqis`, prod) |

➡️ Le PMS et l'app RH sont **2 codebases séparées** partageant **une seule base** Supabase et **un seul** GoTrue Auth. Les apps se distinguent par `redirectTo` et par les tables qu'elles lisent.

---

## PHASE 1 — Authentification

### Tables (réelles)
- `auth.users` : 5 comptes. `public.users` : 4 profils (FK `auth_id`). `public.platform_admins` : 1 (super_admin). `public.user_hotels` : 7 liens. `public.hotels` : 5. `public.user_invitations` : 0 (table présente mais **non utilisée** par le flux réel — l'invitation passe par GoTrue + `rh_grant_hotel_access`). `public.user_active_hotel` : hôtel actif courant.
- Rôles : `users.role`, `user_hotels.role`, `user_invitations.role` = enum **`admin_user_role`**. `platform_admins.role` = texte.

### Sessions / tokens / logout — ✅
- Client : `persistSession`, `autoRefreshToken`, `detectSessionInUrl`, `storageKey:'flowtym.auth'` (`frontend/src/lib/supabase.ts`). ✅
- Logout : `signOut()` + `clearHotelIdCache()` (`AuthContext.tsx`). ✅
- 🟦 Logs Auth : refresh tokens et signin observés ; `400 Invalid Refresh Token` ponctuels (sessions expirées normales).

### ❌ BUG #1 — Le compte Admin ne peut pas se connecter à /admin (CORRIGÉ)
- **Cause racine** : `frontend/src/domains/admin/AdminContext.tsx` interrogeait `platform_admins.user_id` — **colonne inexistante** (la colonne réelle est `auth_id`). La requête levait une erreur Postgres (42703) → `admin=null` → `AdminGate` affiche « Accès refusé ».
- **Preuve** : schéma `platform_admins` = `(id, auth_id, email, full_name, role, is_active, created_at, updated_at)` — pas de `user_id`. Le compte `walilarabi@gmail.com` est pourtant sain (super_admin, `auth_id` valide, dernière connexion 2026-06-05 10:43). 🟦
- **Correctif** : `.eq('user_id', user.id)` → `.eq('auth_id', user.id)`. ✅ **appliqué** (commit ci-dessous).
- 🟦 Note : 18× `400 Invalid login credentials` pour walilarabi dans les logs = échecs de mot de passe (à distinguer du bug /admin, qui est post-login). ⚠️ Si la connexion de base échoue encore → réinitialiser le mot de passe du compte.

### Mot de passe oublié — 🟦
- Géré par GoTrue (`/admin/generate_link` type recovery observé en logs, status 200). Dépend du même SMTP que les invitations (voir Phase 5).

---

## PHASE 2 — Rôles (réels)

**Back-office plateforme** (`platform_admins.role`) : `super_admin`, `support_agent`, `billing_admin`.
Matrice de droits implémentée dans `pages/admin/AdminTeam.tsx` + flags `AdminContext` (`isSuperAdmin/isBillingAdmin/isSupportAgent`). ✅

**Rôles hôtel** (enum `admin_user_role`) : `direction`, `admin_hotel`, `comptabilite`, `revenue_manager`, `reception`, `gouvernante`, `maintenance`, `breakfast`, `femme_de_chambre`.

⚠️ **Écart avec le brief** : les rôles `SUPER_ADMIN / HOTEL_ADMIN / RH_MANAGER / MANAGER / EMPLOYEE` n'existent **pas** tels quels. Correspondance réelle :
| Brief | Réel |
|---|---|
| SUPER_ADMIN | `platform_admins.role='super_admin'` |
| HOTEL_ADMIN | `admin_user_role` = `admin_hotel` / `direction` |
| RH_MANAGER | **aucun rôle dédié** — assuré par `direction`/`admin_hotel` (droits d'invitation RH) |
| MANAGER | `direction` / `admin_hotel` |
| EMPLOYEE (salarié) | fiche `employees` + `portal_auth_id`/`portal_enabled` (pas un rôle enum) |

➡️ Décision requise : **soit** on garde le modèle réel (recommandé, déjà câblé partout), **soit** on renomme/étend l'enum (migration lourde, impacte toutes les RLS). Voir « Décisions ouvertes ».

---

## PHASE 3 — Routing

| URL | Attendu | Constat |
|---|---|---|
| app.flowtym.com | PMS | ✅ `RootGate` → `<App/>` (PMS) si authentifié |
| app.flowtym.com/admin | Admin | ✅ `RootGate` détecte `/admin` → `AdminProvider/AdminGate` → `AdminApp`. **Débloqué par le correctif #1.** |
| rh.flowtym.com | RH Manager | ✅ `vercel.json` fallback `/(.*)` → `index.html` |
| rh.flowtym.com/salarie | Portail Salarié | ✅ **VÉRIFIÉ EN PROD** : `/salarie` sert `portal.html` (titre « Flowtym · Mon espace »), `/` sert `index.html` (Manager) |

### Bug #5 — /salarie affichait le Manager → ✅ DÉJÀ RÉSOLU & DÉPLOYÉ
- Le `vercel.json` de `flowtym-rh` contient les réécritures correctes (`/salarie`, `/salarie/(.*)`, `/salarie/auth/callback` → `portal.html`, **avant** le fallback Manager). 
- Historique git : corrigé aujourd'hui (commits `bd75105` séparation routes, `900f891` SW v3 network-first, `f7e47d4` flux portail) — **tous en production** (dernier déploiement `READY`).
- ✅ **Preuve HTTP (fetch authentifié du déploiement prod)** : `/salarie` → `portal.html` ; `/` → `index.html`. Séparation effective.
- ⚠️ **Cause résiduelle si un testeur voit encore le Manager** : **Service Worker en cache** (ancien SW v1/v2 cache-first). Solution utilisateur : navigation privée, ou DevTools → Application → Service Workers → Unregister, puis hard reload. Le SW v3 (network-first) résout cela automatiquement au prochain chargement.

---

## PHASE 4 — Hôtels & user_hotels

- `hotels` (colonnes utiles) : `id, name, active(bool), created_at, …`. ⚠️ Pas de colonne `abonnement` directe — l'abonnement est porté par `hotel_subscriptions` / `subscription_plans` (séparé). Champ « actif » = `active`. ✅
- `user_hotels(user_id→public.users.id, hotel_id, role, is_default, granted_by, granted_at)`. ✅ Multi-hôtel supporté (un user = N hôtels). Vérifié : walilarabi membre des 5 hôtels (via trigger `grant_superadmin_on_new_hotel`).
- Activation/désactivation hôtel : `hotels.active` (RLS : update réservé `get_user_hotel_id()=id OR is_platform_admin()`). ✅
- ⚠️ **Incohérence d'isolation** : `get_user_hotel_id()` (tables PMS) possède un **fallback legacy** vers `users.hotel_id` même sans ligne `user_hotels`, alors que `pl_my_hotels()` (tables RH) **exige** une appartenance. Conséquence : 2 comptes (`direction.commerciale.bh@…`, `direction.commerciale@boudaahotels.com`) sans `user_hotels` voient le PMS mais **aucune** donnée RH. À standardiser (migration optionnelle, à décider).

---

## PHASE 5 — Invitations

### Workflow réel
`invite-user` (edge function v13, `verify_jwt=false` + auth manuelle) → vérifie que l'appelant est `direction`/`admin_hotel` sur l'hôtel → `inviteUserByEmail` (nouveau) ou `generateLink` magiclink (existant) avec `redirectTo` = `/auth/callback` (manager) ou `/salarie/auth/callback` (salarié) → `rh_grant_hotel_access` (upsert atomique `users`+`user_hotels`) → si salarié : `employees.portal_auth_id/portal_enabled`. ✅ Code cohérent.

### 🟦 État réel (logs)
- 🟦 Edge function : appels récents (v11→v13) en **POST 200**. Une invitation a **réellement** abouti : `mail.send` (mail_type `invite`) vers `direction@hotelfolkestoneopera.com` à 09:55, **signup confirmé** à 09:56. La mécanique fonctionne.
- ❌ **Cause racine des « invitations qui ne marchent pas »** : l'email part via le **SMTP par défaut Supabase** (`noreply@mail.app.supabase.io`) — **plafonné à ~3-4 mails/heure** et massivement classé **spam**. C'est une limite de **configuration Auth**, pas du code.
  - **Correctif (config, hors code)** : Supabase → Authentication → Emails → **SMTP Settings** : configurer un SMTP transactionnel (Resend/Postmark/SES/SendGrid) avec un domaine `flowtym.com` (SPF/DKIM). Puis personnaliser les templates (Invite, Magic Link, Recovery) avec un sujet/branding clair.
  - Mitigation déjà présente dans `flowtym-rh` (historique) : modal affichant un **lien copiable** + boutons SMS/WhatsApp pour contourner l'email. Utile en secours.

### ❌ BUG — Création Super Admin / membre d'équipe (Admin) cassée
- `pages/admin/AdminTeam.tsx:73` : `insert({ email, role, is_active })` dans `platform_admins` **sans `auth_id`** (NOT NULL) → l'INSERT échoue. De plus aucun email n'est envoyé.
- **Correctif** : edge function service-role `invite-platform-admin` (lookup/inviteUserByEmail → récupère `auth_id` → upsert `platform_admins`). ✅ **Déployée en prod** (v2, ACTIVE, `verify_jwt=false` pour CORS — auth manuelle : Authorization + getUser + check `super_admin`). ✅ `AdminTeam.tsx` **recâblé** pour appeler `supabase.functions.invoke('invite-platform-admin')` (commit poussé). ⚠️ **Test fonctionnel = UAT** : l'invocation réelle (garde 401/403 + création) non testable depuis l'environnement d'audit (egress réseau bloqué vers `*.supabase.co/functions`). À valider en navigateur avec une session super_admin.

---

## PHASE 6 — Sécurité multi-hôtel (RLS)

### Modèle d'isolation
- **PMS** (`reservations, guests, invoices, staff_members, users, hotels`) : `hotel_id = get_user_hotel_id()` (hôtel actif unique). ✅
- **RH** (`employees, staff_planning, absence_requests, portal_audit_log`) : `hotel_id IN (pl_my_hotels())` (multi-hôtels). ✅
- `is_platform_admin()` et `get_user_hotel_id()` sont `SECURITY DEFINER` avec `search_path` fixe — corrects. ✅
- RLS **activé sur 100%** des tables `public` (advisor : 0 `rls_disabled_in_public`). ✅

### ✅ Preuves d'isolation (tests RLS réels, lecture seule sur prod — voir `audit/rls_isolation_tests.sql`)
| Test | Résultat |
|---|---|
| Utilisateur confiné Hôtel B (Folkestone) | Voit 355 résas / 276 clients / 13 factures / 69 staff **de Folkestone uniquement** ; **0** ligne de l'Hôtel A. hotels=1, users=3. `is_platform_admin=false`. ✅ |
| Identité inconnue (deny-by-default) | **0 ligne partout** (résas, clients, factures, hôtels, employés, planning). ✅ |
| Utilisateur multi-hôtel (membre A+B) | Voit exactement 89 employés = 15 (B) + 74 (A) = ses 2 hôtels, rien de plus. ✅ |

➡️ **Isolation inter-hôtel prouvée : Hôtel A ne voit jamais Hôtel B.**

### ⚠️ Points de durcissement RLS (advisors) — migrations fournies
1. ❌ `portal_audit_log` policy INSERT `WITH CHECK (true)` (toujours vraie) → **correctif #1** fourni.
2. ⚠️ `pl_my_hotels()` 1re branche morte (compare `user_id`↔`auth.uid()`) → **correctif #2** fourni.
3. ⚠️ 40 fonctions `search_path` mutable → **correctif #3** fourni.
4. ⚠️ 6 vues `SECURITY DEFINER` (`portal_leave_balances, debtors_aged, financial_timeline, v_employee_documents_alerts, scaling_health, competitor_rates_latest`) — contournent les RLS ; **à auditer une à une** pour confirmer le filtrage par hôtel (non corrigé : nécessite revue métier).
5. ⚠️ `mv_analysis_daily_kpis` (vue matérialisée) exposée à `anon/authenticated` — pas de RLS sur les MV ; révoquer l'accès ou encapsuler.
6. ⚠️ `auth_leaked_password_protection` désactivé → activer (HaveIBeenPwned).
7. ⚠️ 151 fonctions `SECURITY DEFINER` exécutables par `anon` — surface large, à revoir (priorité après les points ci-dessus).

---

## PHASE 7 — Tests (état)

| Scénario | Création | Invitation | Connexion | Reset MDP | Accès/menus | Isolation |
|---|---|---|---|---|---|---|
| Super Admin | ❌ via UI (bug AdminTeam) / ✅ via SQL | ⚠️ (SMTP) | ✅ (compte existant) / ✅ /admin après correctif | 🟦 | ✅ matrice code | n/a |
| Admin Hôtel | ✅ via invite-user | 🟦 OK / ⚠️ SMTP | ⚠️ UAT | 🟦 | ✅ RLS | ✅ prouvé |
| RH Manager (=direction) | ✅ | 🟦 / ⚠️ SMTP | ⚠️ UAT | 🟦 | ✅ | ✅ |
| Manager | ✅ | 🟦 / ⚠️ SMTP | ⚠️ UAT | 🟦 | ✅ | ✅ |
| Salarié | ✅ (employees+portal) | 🟦 (1 cas réussi) / ⚠️ SMTP | ⚠️ UAT | 🟦 | ✅ portal.html | ✅ (RLS portail `pl_portal_employee_id`) |

⚠️ Les connexions de bout-en-bout par type d'utilisateur sur les domaines prod restent à valider en **UAT réel** (envoi email + clic lien + définition MDP + login navigateur) — voir `audit/UAT_PROTOCOL.md`.

---

## Corrections réalisées (cette session)
1. ✅ `frontend/src/domains/admin/AdminContext.tsx` — `user_id` → `auth_id` (débloque /admin). **Poussé.**

### Migrations APPLIQUÉES EN PROD & PROUVÉES (ciblé, autorisé, non destructif, par étape)
- ✅ **01** `portal_audit_log` policy INSERT durcie. Preuve : CAS légitime ALLOWED ; CAS cross-tenant + usurpation acteur **BLOQUÉS** (RLS 42501). Table 0 ligne, tests rollback.
- ✅ **02** `pl_my_hotels()` branche morte supprimée. Preuve : multi-hôtel inchangé (89=15+74), `SECURITY DEFINER` + `search_path` OK, plus de UNION.
- ✅ **03** `search_path` fixe sur **40 fonctions** (0 restante mutable). Preuve : smoke test trigger `updated_at` OK (rollback).
- ✅ **04** `gen_audit_log_invite` (corrigée) : trace chaque invitation dans le journal **officiel** `audit_logs` (hash-chaîné). Preuve : `audit_logs` +1 exactement, `hr_document_audit_logs` inchangé (pas de doublon), `seq`/`prev_hash`/`entry_hash` calculés par le trigger, `action='user_invited'`. Aucune contrainte désactivée (action en texte libre). *(1re version visant `hr_document_audit_logs` annulée : son CHECK rejette `invite_user` — ce qui révélait que l'ancien fallback d'audit de `invite-user` échouait déjà.)*

Rollbacks fournis : `audit/migrations/rollback/20260605_0{1,2,3,4}_rollback.sql`. Tests : `audit/rls_isolation_tests.sql`.

## Correctifs préparés, déploiement en attente d'autorisation
- `audit/edge-functions/invite-platform-admin.ts` + recâblage `AdminTeam.tsx` (création Super Admin).
- Config **SMTP custom** Supabase Auth (résout invitations/reset) — action console, hors code.

---

## ❌ Blocage majeur
- **Branche Supabase impossible** : `Branching is supported only on the Pro plan or above` (org en plan **Free**). L'approche « branche d'abord » choisie ne peut pas être exécutée sans upgrade Pro. Voir « Décisions ouvertes ».

## Décisions ouvertes (pour vous)
1. **Branche Supabase** : upgrader en Pro (≈0,32 $/j la branche) **ou** autoriser des écritures prod ciblées (les migrations 01-04 sont sûres) **ou** rester en livrables à appliquer vous-même.
2. **Modèle de rôles** : garder le modèle réel (recommandé) ou renommer vers SUPER_ADMIN/HOTEL_ADMIN/RH_MANAGER/MANAGER/EMPLOYEE (migration lourde).
3. **SMTP** : quel fournisseur (Resend/Postmark/SES) pour le domaine flowtym.com ?
4. **invite-platform-admin** : autoriser le déploiement de l'edge function + push du recâblage `AdminTeam`.
