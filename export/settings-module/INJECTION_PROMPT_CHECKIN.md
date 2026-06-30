# Prompt d'injection — Module Paramètres (Settings)
## Cible : Checkin flowtym

> À coller dans Claude Code (ou l'assistant IA) **ouvert dans Checkin
> flowtym**, après avoir décompressé `settings-module.zip` dans
> `tmp/import-settings/` du projet.

---

## CONTEXTE

J'extrais le **module Paramètres** (Settings) du projet **FLOWTYM PMS** pour
l'injecter dans **Checkin flowtym**.

**Ce que c'est** : centre de configuration du PMS, organisé en 10 domaines /
~50 sous-pages :

- **Établissement** : profil hôtel, multi-hôtel, branding, fiscalité, RGPD…
- **Chambres** : types, chambres physiques, étages, statuts HK
- **Tarifs** : plans tarifaires, saisons, conditions, catégories d'âge
- **Facturation** : numérotation, moyens de paiement, comptabilité, débiteurs
- **Partenaires** : OTA, commissions, promotions
- **Communication** : email, SMS, WhatsApp, templates, journal
- **Utilisateurs** : users, rôles, permissions, sessions, clés API
- **Système** : audit, sauvegardes, santé, intégrations, import/export
- **Préférences** : langues, taxes locales, notifications, automation

**Périmètre** : fermeture transitive sur 2 points d'entrée (`SettingsView`,
`SettingsLayout`) → **130 fichiers / ~33 800 lignes / 0 import non résolu**.

**⚠️ Particularités à comprendre AVANT de commencer** :

1. **C'est le plus gros module** extrait à ce jour (vs Analyse 50 fichiers,
   Revenue 93). Plus de surface = plus de deps infra à arbitrer.

2. La fermeture tire **plusieurs stores et services Revenue/Events/RMS** parce
   que certaines sous-pages les utilisent (`settings_rate_plans`,
   `settings_events`, `settings_automation`). Si tu n'actives pas ces
   sous-pages, tu peux les supprimer pour réduire le poids.

3. **Module Analyse et/ou Revenue déjà injectés** ? Si oui, **réutilise
   exactement la même convention de rebranchement** (Supabase, cn, toast,
   ErrorBoundary, store config, auth). Plein de fichiers vont déjà exister
   côté Checkin → SKIP, ne réécris pas.

Package décompressé dans `tmp/import-settings/` :
- `README.md` — doc d'intégration détaillée (LIS-LA, surtout §5 et §6).
- `INJECTION_PROMPT_CHECKIN.md` — **CE FICHIER**.
- `src/` — 130 fichiers, arborescence à préserver.
- `sql/` — 7 migrations Supabase (980 lignes).

---

## TA MISSION

Procède dans cet ordre. **MONTRE-MOI TON PLAN AVANT D'ÉCRIRE DU CODE.**

---

### ÉTAPE 1 — Audit Checkin (CRITIQUE pour ce module)

**A. Statut des modules précédents**
Confirme-moi factuellement :
- Le module **Analyse** est-il déjà injecté dans Checkin ? Si oui, quelles
  conventions ont été établies pour : client Supabase, cn helper, toast,
  ErrorBoundary, store config (configStore), auth (AuthContext) ?
- Le module **Revenue** (Calendrier + Automatisation) est-il injecté ? Si oui,
  quelles deps infra additionnelles ont été rebranchées : `domains/auth/*`,
  `permissionsService`, `i18n/*` ?

**B. Stack (rapide)**
- React/Vite/TS/Tailwind confirmés ?
- Alias `@` → racine ?
- `react-query` + `QueryClientProvider` montés ?
- `public.get_user_hotel_id()` existe en base ?

**C. Briques infra que CE module tire (la liste complète — vérifier ce qui
existe déjà côté Checkin pour ne pas doublonner)**

| Brique | Présente côté Checkin ? | Action |
|---|---|---|
| Client **Supabase** | (réutiliser celui posé par Analyse/Revenue) | rebrancher |
| `cn()` helper | (réutiliser) | rebrancher |
| Toast (`hooks/use-toast`) | (réutiliser) | rebrancher |
| `withTimeout` helper | (peut-être nouveau) | garder si pas présent |
| `lib/hotelId.ts` (`resolveHotelId`) | dépend de ton multi-tenant | adapter |
| `AuthContext` (`domains/auth/*`) | (réutiliser celui de Revenue) | rebrancher |
| `usePagePermission` (`permissionsService`) | (réutiliser) | rebrancher ou stub |
| `configStore` (Zustand) | (réutiliser) | rebrancher |
| `RevenueHeader` (en-tête de page) | (réutiliser ou PageHeader Checkin) | rebrancher |
| `ErrorBoundary` | (réutiliser) | rebrancher |
| Stores `eventsStore`, `rmsAutomationStore` | NEW si Revenue/Events pas injectés | voir §D |
| Composants `components/rms/*` (10 fichiers) | NEW si Revenue pas injecté | voir §D |
| `services/communication/*` (3) | NEW | voir §D |

**D. Décisions sur le PÉRIMÈTRE FONCTIONNEL** (CRITIQUE — réduit drastiquement
le poids)

Les 36 sous-pages couvrent toute la config PMS. Toutes ne sont probablement
pas pertinentes pour Checkin. **Demande-moi quelles sous-pages activer** parmi
celles-ci, par groupes :

```
SETUP DE BASE (probablement OUI) :
- settings_hotel, settings_branding, settings_languages
- settings_room_types, settings_rooms, settings_floors, settings_room_status
- settings_preferences

TARIFAIRE (selon si Revenue injecté) :
- settings_rate_plans, settings_seasons, settings_conditions
- settings_age_categories

FACTURATION (probablement OUI pour un PMS) :
- settings_invoice, settings_numbering, settings_payment_modes
- settings_accounting, settings_fiscal, settings_debtors, settings_local_taxes

PARTENAIRES (si Distribution voulue) :
- settings_partners, settings_integration

COMMUNICATION (probablement OUI) :
- settings_communication, settings_notifications

USERS / SECURITY (probablement OUI) :
- settings_users, settings_roles, settings_sessions, settings_api_keys
- settings_rgpd

SYSTÈME (à voir) :
- settings_audit, settings_backups, settings_system_health
- settings_import_export

AVANCÉ / NICHE (souvent NON sur un Checkin simple) :
- settings_automation, settings_products, settings_hk_status
- settings_reservation*, settings_multihotel
```

**Sans ta réponse je dois supposer "tout activer" — ce qui veut dire 130
fichiers et beaucoup d'infra à brancher. Indique-moi le sous-ensemble voulu
pour réduire le périmètre.**

**E. Schéma DB**
- Confirme : multi-tenant ou mono ? Tables PMS de base présentes (`hotels`,
  `users`, `rooms`, `room_types`, `rate_plans`) ?
- Tables `pricing_rules`, `rate_prices`, `rate_restrictions` présentes (si
  Revenue injecté → oui ; sinon non) ?

**Présente le résultat sous forme de tableau / liste. Attends ma validation du
PLAN avant de toucher au code.**

---

### ÉTAPE 2 — Dépendances npm additionnelles

Par rapport à Analyse/Revenue, Settings ajoute :
```
@dnd-kit/core         @dnd-kit/sortable    @dnd-kit/utilities
jspdf                 jspdf-autotable
xlsx                  (déjà via Analyse si injecté)
```
Le reste est déjà installé.

---

### ÉTAPE 3 — Placement avec ATTENTION aux doublons

Copie `tmp/import-settings/src/` dans `src/` de Checkin en **préservant
l'arborescence**.

**⚠️ Beaucoup de fichiers vont déjà exister côté Checkin** (parce qu'Analyse
et/ou Revenue les ont déjà copiés). Pour CHAQUE fichier susceptible d'être
déjà présent :

- `lib/supabase.ts`, `lib/utils.ts`, `lib/supabase.types.ts`, `lib/hotelId.ts`,
  `lib/withTimeout.ts`, `lib/rms/*` (4 fichiers)
- `domains/auth/*` (3 fichiers)
- `domains/_shared/errors.ts`
- `store/configStore.ts`, `store/eventsStore.ts`, `store/rmsAutomationStore.ts`
- `components/rms/*` (types, store rateCalendar, engines)
- `services/settings/permissionsService.tsx`, `monitoringService.ts`
- `services/event-impact.engine.ts`, `event-rms-integration.service.ts`
- `services/revenue/centralPricingEngine.service.ts`
- `services/rms-decisions.service.ts`, `services/rms/rmsSupabasePersistence.ts`
- `services/events/eventsRepository.ts`
- `data/megaArtistRegistry.ts`, `eventSourceLibrary.ts`, `data/rms/events.ts`
- `constants/partners.ts`
- `types.ts`, `types/events.ts`, `types/settings/diagnostic.ts`

**Compare AVANT d'écraser, et NE RÉÉCRIS PAS si Checkin a déjà la version
issue d'Analyse/Revenue. Liste-moi chaque conflit + ta proposition (skip /
merge / remplacer) AVANT de l'appliquer.**

---

### ÉTAPE 4 — Réduction du périmètre (selon §D de l'étape 1)

Une fois que je t'ai dit quelles sous-pages activer :

1. Édite `pages/settings/settingsNavigation.ts` pour ne conserver QUE les
   entrées des sous-pages voulues.
2. Supprime les fichiers `pages/settings/pages/*` correspondant aux sous-pages
   non activées.
3. Supprime les dossiers/services tirés UNIQUEMENT par ces sous-pages :
   - Si `settings_communication` désactivé → supprime
     `services/communication/*` + `pages/settings/pages/communication/*`.
   - Si `settings_events` / `settings_automation` désactivés → supprime
     `store/eventsStore.ts`, `data/megaArtistRegistry.ts`,
     `data/eventSourceLibrary.ts`, `services/event-*`, etc.
   - Si `settings_rate_plans` désactivé → supprime `RatePlanSheet.tsx`,
     `RatePlanImportModal.tsx`, `RatePlansPage.tsx`, services associés.
4. Lance `tsc --noEmit` après chaque suppression pour valider qu'aucun import
   ne casse.

**Présente-moi la liste des fichiers à supprimer AVANT de le faire.**

---

### ÉTAPE 5 — Arbitrage deps infra (sensible — voir §C étape 1)

Pour chaque brique infra :

- **Déjà rebranchée par Analyse/Revenue** → applique exactement la même
  convention. Pas de divergence.
- **Nouvelle (jamais rencontrée)** → propose-moi un rebranchement OU un stub
  minimal, et attends ma validation.

Cas particuliers à signaler :
- **`SettingsCommandPalette`** (Ctrl+K) — composant lourd. Désactivable si
  pas voulu (un seul import à retirer dans `SettingsLayout`).
- **`SettingsControlCenter`** — dashboard santé config qui agrège beaucoup
  d'infos. Peut être remplacé par une page d'accueil simple si trop coûteux.
- **`settingsDiagnosticEngine`** — moteur de diagnostic qui scanne toute la
  config. Lourd. Peut être stubé.

---

### ÉTAPE 6 — Base de données

#### 6a. Prérequis
Confirmé étape 1 : `get_user_hotel_id()` existe + tables PMS de base présentes.

#### 6b. Déploie via `apply_migration` du MCP Supabase

Dans l'ordre chronologique :
1. `sql/20260524_settings_phase2.sql` (settings_audit_log, permissions_matrix,
   event_sources, imported_rate_plans, virtual_rooms)
2. `sql/20260526_settings_config_blobs.sql` (settings_config_blobs — clef
   de persistance JSON générique)
3. `sql/20260627_communication_and_badges.sql` (hotel_email_settings,
   hotel_whatsapp_settings, communication_templates, communication_logs)
4. `sql/20260612_cancellation_policies.sql`
5. `sql/20260609_distribution_partners.sql`
6. `sql/20260610_partners_module.sql`
7. `sql/20260611_dist_partner_commissions_promotions.sql`

**Adapte chaque SQL au schéma Checkin** si conventions différentes (noms de
contraintes, types, RLS multi vs mono-tenant).

#### 6c. Tables manquantes
Le module touche aussi `pricing_rules`, `rate_prices`, `rate_restrictions`,
`hotel_rms_events`, `rms_decisions`, `rate_plan_room_type_assignments` qui ne
sont PAS dans les migrations fournies. Si tu as déjà injecté **Revenue**, elles
existent. Sinon, signale-moi que tu en as besoin.

#### 6d. Si tu as désactivé des sous-pages
Tu peux skipper les SQL correspondants :
- Pas de `settings_communication` → skip `20260627_communication_and_badges.sql`.
- Pas de `settings_partners` → skip `_distribution_partners`, `_partners_module`,
  `_dist_partner_commissions_promotions`.
- Pas de `settings_conditions` → skip `cancellation_policies`.

---

### ÉTAPE 7 — Câblage

Monte `<SettingsView>` dans le routeur de Checkin :
```tsx
import { SettingsView } from '@/src/pages/SettingsView';
<SettingsView activePage={page} onNavigate={setPage} />
```
`activePage` ∈ liste page IDs (§2 du README, filtrée selon §4 de ce prompt).

Ajoute une entrée "Paramètres" / icône engrenage dans la nav globale de
Checkin pointant sur `settings`.

---

### ÉTAPE 8 — Vérification finale

- [ ] `npm install` propre.
- [ ] `tsc --noEmit` : 0 erreur (après suppressions §4).
- [ ] `npm run build` réussit.
- [ ] L'app démarre, route Settings ouvre.
- [ ] La barre des 10 domaines s'affiche.
- [ ] Navigation entre sous-pages activées OK.
- [ ] **Au moins une mutation testée** : ex. créer un type de chambre, voir
      le toast succès, la base reçoit la ligne.
- [ ] Tailwind appliqué.
- [ ] Pas de doublon dans la console (1 seul AuthContext, 1 seul QueryClient,
      1 seul configStore).
- [ ] Console : pas d'erreur bloquante.

---

## RÈGLES STRICTES

1. **Audit + plan AVANT code.** Pour ce module surtout : sa taille rend
   l'improvisation dangereuse.
2. **Réutilise la convention** établie pour Analyse/Revenue (Supabase, cn,
   toast, auth, configStore…).
3. **NE doublonne PAS** les fichiers déjà copiés par Analyse/Revenue. Compare
   avant d'écraser, SKIP si identique.
4. **Réduis le périmètre** : demande-moi quelles sous-pages activer (§D étape
   1) avant de tout copier. Beaucoup peuvent être supprimées.
5. **Demande-moi avant** : suppression de bloc fonctionnel, choix mono/multi-
   tenant, adaptation d'un SQL.
6. **Adapte le SQL au schéma Checkin** AVANT exécution.
7. **Incrémente** : après chaque étape majeure, montre résultat
   (diff/build/screenshot) avant de continuer.
8. **Lis `README.md`** — surtout §5 (deps infra) et §6 (DB) — avant de
   commencer.

## SI TU ES BLOQUÉ

Arrête, explique factuellement (fichier/ligne/conflit), propose 2-3 options
+ trade-offs, attends ma décision.

Mieux vaut s'arrêter et demander que produire du code que je devrai défaire.
