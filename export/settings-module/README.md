# Module Paramètres (Settings)

Extrait de **FLOWTYM PMS** pour injection dans un autre projet React/TypeScript.

Centre de configuration du PMS — **le plus gros module** : 10 domaines, ~50
sous-pages, ~130 fichiers / ~33 800 lignes.

> Périmètre calculé par **fermeture transitive** depuis les 2 points d'entrée
> (`SettingsView`, `SettingsLayout`) → 130 fichiers, **0 import non résolu**.

---

## 1. Point d'entrée

**Un seul composant** : `SettingsView`, piloté par 2 props.

```tsx
import { SettingsView } from '@/src/pages/SettingsView';

<SettingsView
  activePage={page}                       // 1 page ID sur 36 (voir §2)
  onNavigate={(p) => setPage(p)}           // callback navigation interne
/>
```

`SettingsView` délègue à `SettingsLayout` qui fournit toute la chrome interne
(barre horizontale 10 domaines + sub-nav verticale + contenu).

---

## 2. Page IDs (36)

```
settings                          // Control Center (vue d'ensemble)
settings_hotel                    // Profil hôtel
settings_multihotel               // Multi-hôtel
settings_room_types               // Types de chambres
settings_rooms                    // Chambres physiques
settings_floors                   // Étages
settings_room_status              // Statuts chambres
settings_preferences              // Préférences globales
settings_products                 // Produits / Extras
settings_rate_plans               // Plans tarifaires
settings_conditions               // Conditions générales
settings_seasons                  // Saisons
settings_age_categories           // Catégories d'âge
settings_invoice                  // Factures
settings_numbering                // Numérotation
settings_payment_modes            // Moyens de paiement
settings_accounting               // Comptabilité
settings_debtors                  // Débiteurs
settings_fiscal                   // Fiscalité
settings_hk_status                // Housekeeping — statuts
settings_partners                 // Partenaires & OTA
settings_local_taxes              // Taxes locales
settings_languages                // Langues
settings_reservation*             // Réservations (plusieurs sous-pages)
settings_communication            // Communication (email/SMS/WhatsApp/templates)
settings_notifications            // Notifications
settings_integration*             // Intégrations / Connecteurs / Webhooks
settings_users                    // Utilisateurs
settings_roles                    // Rôles & permissions
settings_sessions                 // Sessions actives
settings_api_keys                 // Clés API
settings_audit                    // Audit log
settings_backups                  // Sauvegardes
settings_branding                 // Identité visuelle
settings_rgpd                     // RGPD
settings_system_health            // Santé système
settings_import_export            // Import / Export
settings_automation               // Règles d'automatisation
```

---

## 3. Dépendances npm (14)

```jsonc
{
  "@supabase/supabase-js":  "^2.105.4",
  "@tanstack/react-query":  "^5.100.6",   // QueryClientProvider requis
  "lucide-react":           "^0.546.0",
  "zustand":                "^5.0.12",
  "zod":                    "^3.x",
  "clsx":                   "^2.x",
  "tailwind-merge":         "^2.x",
  "@dnd-kit/core":          "^6.x",        // drag & drop (réordonner listes)
  "@dnd-kit/sortable":      "^7.x",
  "@dnd-kit/utilities":     "^3.x",
  "jspdf":                  "^2.x",        // export PDF (audit, rapports)
  "jspdf-autotable":        "^3.x",
  "xlsx":                   "^0.18.5"      // import/export Excel
}
```

+ **Tailwind CSS** obligatoire + `QueryClientProvider` à la racine.

---

## 4. Arborescence (130 fichiers)

```
src/
├── pages/SettingsView.tsx              (20 l — point d'entrée)
└── pages/settings/                     (65 fichiers — TOUT le module)
    ├── SettingsLayout.tsx               chrome interne (nav 10 domaines)
    ├── SettingsCommandPalette.tsx       palette Ctrl+K
    ├── SettingsControlCenter.tsx        dashboard santé config
    ├── settingsNavigation.ts            définition des 36 pages
    ├── pages/                           sous-pages (~50)
    │   ├── HotelInfoPage, RoomTypesPage, RoomTypeSheet, …
    │   ├── RatePlansPage, RatePlanSheet, RatePlanImportModal, …
    │   ├── PartnersPage, UsersPage, RolesAccessPage, …
    │   └── communication/               EmailSettings, SmsSettings, WhatsApp…
    └── widgets/                         (11) Checklist, GuidedSetup, ScoreTrends…

src/services/settings/                  (16 fichiers — couche persistence)
├── settingsPersistence.ts               persistance générique config_blobs
├── settingsAuditLogger.ts               log d'audit
├── settingsDiagnosticEngine.ts          moteur santé/diagnostic
├── settingsBackends.ts                  backends d'export
├── settingsSimulator.ts                 simulation d'impact
├── settingsExportService.ts             export config
├── settingsHistory.ts                   historique modifs
├── rate-plans.service.ts                CRUD plans tarifaires
├── rate-plan-import.service.ts          import Excel plans
├── rate-plan-integration.service.ts     intégration imports
├── partners.service.ts                  CRUD partenaires
├── partner-rate-import.service.ts       import tarifs partenaire
├── partner-rate-import.persist.ts       persist imports partenaire
├── cancellation.service.ts              politiques d'annulation
├── permissionsService.tsx               gating canRead/canWrite
└── monitoringService.ts                 capture erreurs globales

src/services/communication/             (3) email/sms/whatsapp + templates
src/services/events/                    (1) eventsRepository
src/services/rms/                       (1) rmsSupabasePersistence
src/services/revenue/                   (1) centralPricingEngine
src/services/                            event-impact, event-rms-integration,
                                         rms-decisions

src/components/rms/                     (10) types, engines, store rateCalendar
src/lib/                                 supabase, utils, hotelId, withTimeout
src/lib/rms/                            (4) strategies, eventBus…
src/store/                              configStore, eventsStore, rmsAutomationStore
src/hooks/settings/                     (3) hooks settings
src/domains/                            auth (3), hotel (1), settings (2), _shared (1)
src/data/                               megaArtistRegistry, eventSourceLibrary,
                                         rms/events
src/constants/partners.ts
src/types/                              events, settings/diagnostic
src/types.ts
```

---

## 5. ⚠️ Dépendances infra tirées par la closure

Comme Revenue, ce module est trop intégré pour ne tirer QUE des fichiers
"Settings purs". La closure tire ces briques transverses — **ne crée PAS de
doublon** côté projet cible :

| Dep | Pourquoi tirée | Reco |
|---|---|---|
| `lib/supabase.ts` | client Supabase | rebrancher sur le tien |
| `lib/utils.ts` (cn) | clsx+tailwind-merge | rebrancher |
| `lib/withTimeout.ts` | timeout sur appels Supabase | garder (utile, peu invasif) |
| `lib/hotelId.ts` | helper `resolveHotelId()` | dépend de ton multi-tenant |
| `domains/auth/*` (3 fichiers) | AuthContext + repository | rebrancher sur ton auth |
| `domains/hotel/*` | hooks hôtel | rebrancher ou garder |
| `domains/settings/*` (2) | hooks settings | garder |
| `store/configStore.ts` (300 l) | store config hôtel | rebrancher ou stub |
| `store/eventsStore.ts`, `rmsAutomationStore.ts` | stores Zustand — **tirés par les pages settings_events et settings_automation** | si tu n'actives pas ces sous-pages, supprimables ; sinon garder |
| `components/rms/*` (10 fichiers : types/engines/store rateCalendar) | tirés par les pages tarifaires de settings | requis pour `settings_rate_plans` |
| `services/communication/*` | tirés par `settings_communication` | requis pour cette section |
| `services/event-*`, `events/`, `rms-decisions` | tirés par `settings_events` et `settings_automation` | supprimables si ces sections non activées |
| `data/megaArtistRegistry.ts`, `eventSourceLibrary.ts` | données pour `settings_events` | idem |

**Conseil** : si Checkin n'a pas vocation à activer toutes les 36 sous-pages,
identifie celles que tu veux et **désactive les autres dans `settingsNavigation.ts`**
+ supprime les fichiers correspondants. Réduit significativement le poids.

---

## 6. Base de données

**Prérequis** : `public.get_user_hotel_id() RETURNS uuid` (multi-tenant).

**Tables PMS de base attendues côté cible (NON fournies)** :
- `hotels`, `users`, `rooms`, `room_types`, `rate_plans` — un PMS standard les
  a déjà.

**Migrations fournies dans `sql/` (7 fichiers, 980 lignes)** :

| Fichier | Tables / objets |
|---|---|
| `20260524_settings_phase2.sql` | `settings_audit_log`, `settings_permissions_matrix`, `settings_event_sources`, `settings_imported_rate_plans`, `settings_virtual_rooms` |
| `20260526_settings_config_blobs.sql` | `settings_config_blobs` (persistance JSON générique des configs) |
| `20260627_communication_and_badges.sql` | `hotel_email_settings`, `hotel_whatsapp_settings`, `communication_templates`, `communication_logs` |
| `20260612_cancellation_policies.sql` | `cancellation_policies` |
| `20260609_distribution_partners.sql` | `distribution_partners`, `rate_plan_partner_mappings` |
| `20260610_partners_module.sql` | `partner_room_mappings` |
| `20260611_dist_partner_commissions_promotions.sql` | `dist_partner_commissions`, `dist_partner_promotions` |

> ⚠️ Le module touche aussi `pricing_rules`, `rate_prices`, `rate_restrictions`
> (tables Revenue) et `hotel_rms_events`, `rms_decisions`, `rate_plan_room_type_assignments`
> qui ne sont pas dans les migrations ici. Si tu as déjà injecté le module
> Revenue (Calendrier + Automatisation), elles existent déjà. Sinon, déploie
> aussi les SQL de ce module-là.

Adapte le SQL à ton schéma si conventions différentes.

---

## 7. Checklist d'intégration

- [ ] Copier `src/` dans le `src/` cible (préserve l'arborescence).
- [ ] Installer les 14 deps npm (§3) + Tailwind + QueryClientProvider.
- [ ] Vérifier alias `@` → racine.
- [ ] Arbitrer les deps infra (§5) — rebrancher au lieu de doublonner.
- [ ] Décider quelles **sous-pages activer** (36 max), désactiver les autres
  dans `settingsNavigation.ts`, supprimer les fichiers correspondants.
- [ ] Régler `get_user_hotel_id()` + tables PMS de base (`hotels`, `users`,
  `rooms`, `room_types`, `rate_plans`).
- [ ] Exécuter les 7 SQL de `sql/` (dans l'ordre chronologique).
- [ ] Câbler `<SettingsView>` dans le routeur.
- [ ] `tsc --noEmit` / build OK ; Settings ouvre, navigation entre sous-pages.

---

## 8. Notes

- `SettingsCommandPalette` (Ctrl+K) est inclus — peut être désactivé si non
  voulu.
- `SettingsControlCenter` est un dashboard de santé config qui agrège pas mal
  d'infos — peut être remplacé par une page d'accueil simple si trop coûteux.
- Aucun test n'est inclus (`.test.tsx` exclu de la closure runtime).
- Le module est **plus gros et plus invasif** que Revenue (130 fichiers vs 93)
  — prévois un audit sérieux côté cible avant injection.

*Extrait le 2026-06-30 — fermeture transitive 2 entrées, 130 fichiers, 0 import non résolu.*
