# AUDIT EXPERT – MODULE CLIENTS FLOWTYM

## Synthèse

| Axe | Note | Justification | Recommandation prioritaire |
|-----|------|---------------|-----------------------------|
| **Couverture fonctionnelle** | **7.5/10** | La vision couvre le socle CRM hôtelier (profil, préférences, incidents, documents, communications, segments, tags, RGPD). Il manque toutefois des blocs “opérationnels temps réel” (alerting séjour, orchestration tâches inter-modules, lifecycle automation) et des métriques natives CLV/churn. | Ajouter un **Customer Intelligence Layer** (CLV, churn risk, next-best-action, duplicate confidence) exposé partout (liste, drawer, API, exports). |
| **UX / Navigation** | **7/10** | Le périmètre fonctionnel est riche mais risque de surcharge cognitive si tout est affiché au même niveau. Sans architecture d’écrans “List-first + Context drawer + Side actions”, la productivité front-office baisse. | Implémenter une UX en **3 plans**: liste virtualisée + drawer 10 onglets + command bar globale (⌘K) avec raccourcis métier. |
| **RGPD & conformité** | **6.5/10** | Tu mentionnes anonymisation/consentement/export, mais la conformité exige une traçabilité juridique forte: base légale, preuve de consentement, horodatage, rétention, purge, journal immuable et DSAR SLA. | Introduire un **Privacy Ledger** (consent events, legal basis, retention deadlines, anonymization jobs, audit trail inviolable). |
| **Scalabilité multi-tenant** | **8/10** | Les contraintes RLS + tenant_id sont bonnes. Mais à l’échelle groupe hôtelier/multi-propriétés, il faut gérer parent_tenant, data residency, quotas, clés de partition et anti-noisy-neighbor. | Adopter un modèle **tenant + property + brand** avec index composites, partitionnement temporel des événements et cache Redis namespacé. |
| **Intégration avec autres modules** | **7.5/10** | Les dépendances avec réservations/housekeeping/billing sont bien ciblées, mais les contrats d’événements et l’orchestration de workflows inter-modules ne sont pas formalisés. | Créer un **event contract registry** (CustomerCreated, ConsentUpdated, IncidentOpened, VIPChanged) + outbox pattern. |
| **Fonctions différenciantes (vs concurrence)** | **6.5/10** | Le scope est ambitieux mais proche des leaders si non enrichi par IA appliquée et automatisations décisionnelles. | Prioriser 3 différenciateurs “wow”: **merge IA assisté**, **next best action front-desk**, **segment live + campagne déclenchée**. |

---

## 1) Couverture fonctionnelle – Note 7.5/10

### Points forts
- Vision 360° client: identité, préférences, incidents, documents, communications.
- Orientation CRM activable (tags, segments, campagnes).
- Inclusion explicite RGPD (anonymisation, export, consentement).

### Faiblesses à combler
- Pas de modèle “jour d’opération”: alertes de séjour (arrivée imminente, no-show risk, litige en cours).
- Manque de score consolidé utilisable en réception: valeur, risque, priorité service.
- Peu de focus sur gouvernance qualité données (completeness score, freshness score, duplicate resolution SLA).

### Recommandation immédiate
- Ajouter un **Customer Health Panel** dans la liste et le drawer:
  - CLV 12/24 mois
  - Churn risk
  - Data completeness
  - Consent status
  - Incident severity

## 2) UX / Navigation – Note 7/10

### Risques UX
- Trop d’actions possibles sans hiérarchie (profil, finance, marketing, conformité).
- Risque de multiplier les écrans au lieu d’un flux continu.

### Pattern recommandé
- **Centre** = table clients virtualisée, ultra-rapide.
- **Droite** = drawer persistant (10 onglets), sans navigation plein écran.
- **Haut** = KPIs + filtres enregistrables + actions globales.
- **⌘K / Ctrl+K** = commande rapide (fusion, anonymiser, créer tâche, envoyer message).

### Recommandation immédiate
- Définir 3 niveaux d’action:
  1. Actions instantanées (tag, favori, assignation)
  2. Actions guidées (merge wizard)
  3. Actions sensibles (RGPD, suppression logique)

## 3) RGPD & conformité – Note 6.5/10

### Exigences manquantes
- Preuve de consentement (canal, source, horodatage, IP/user-agent si web).
- Base légale par finalité (marketing, opérationnel, facturation).
- Mécanisme de rétention + purge/anonymisation automatique.
- Journal DSAR (demande, délai, exécution, preuve de livraison export).

### Recommandation immédiate
- Implémenter des tables dédiées: `customer_consents`, `customer_privacy_requests`, `customer_anonymization_jobs`.
- Politique: **anonymisation irréversible** des PII + conservation des écritures légales minimales.

## 4) Scalabilité multi-tenant – Note 8/10

### Solide
- Orientation RLS et scoping tenant.

### À renforcer
- Multi-établissement (groupes hôteliers) et hiérarchie brand/property.
- Partitionnement tables volumineuses (`communications`, `events`, `incidents`).
- Limites par tenant (rate limit API, quotas exports lourds).

### Recommandation immédiate
- Schéma de clés:
  - `tenant_id` (groupe)
  - `property_id` (hôtel)
  - `brand_id` (enseigne)
- Index systématiques `(tenant_id, property_id, updated_at desc)`.

## 5) Intégration – Note 7.5/10

### Dépendances critiques
- Réservations: historique séjours, no-show, ADR, canal OTA.
- Billing: statut payeur, incidents paiement, RFM monétaire.
- Housekeeping: préférences chambre, incidents séjour.
- Marketing: segments dynamiques & consent-aware campaigns.

### Recommandation immédiate
- Standardiser événements métiers (schema versionné JSON):
  - `reservation.checked_in`
  - `invoice.paid`
  - `incident.created`
  - `customer.consent.updated`

## 6) Différenciateurs – Note 6.5/10

### Pour battre Mews/Opera/Apaleo
1. **Duplicate Merge Copilot** (IA explicable: score + raisons + simulation avant fusion).
2. **Next Best Action Desk** (actions contextuelles à l’arrivée/départ selon valeur + risque).
3. **Live Segmentation** (segments recalculés en quasi temps réel + déclencheurs campagnes).
4. **Service Recovery Intelligence** (détection clients à risque d’avis négatif + plan d’action).

---

## LACUNES IDENTIFIÉES (vs standards marché)

| Fonctionnalité manquante | Pourquoi c’est critique | Solution proposée |
|---|---|---|
| CLV prédictive multi-horizon (3/6/12 mois) | Priorisation VIP incomplète sans projection | Modèle CLV (RFM + fréquence + canal + saisonnalité) recalcul journalier |
| Churn risk score | Anticiper perte client et baisse repeat | Classifieur churn avec signaux incidents/no-show/inactivité |
| Next Best Action (NBA) front-desk | Aide opérationnelle faible en temps réel | Moteur règles + scoring pour recommander upgrade/offre/geste commercial |
| Completeness/Freshness score | Base CRM se dégrade sans gouvernance qualité | Calcul automatique score qualité + tâches de remédiation |
| Identity resolution avancée (cross-canal) | Doublons fréquents OTA/direct/corporate | Matching hybride: exact + fuzzy + embedding + revue humaine |
| Timeline unifiée omnicanale | Vision fragmentée des interactions | Event stream client unifié (réservation, email, incident, paiement) |
| Consent center granulaire | Risque juridique sur communications | Consentements par canal/finalité/source avec preuve horodatée |
| DSAR workflow outillé | Non-conformité délais RGPD | Workflow demandes accès/effacement/export avec SLA et audit |
| Bloc corporate/agency relations | Segment B2B mal exploité | Entités company/agency + negotiated rates + responsable commercial |
| Household/Travel party linking | Mauvaise personnalisation groupe/famille | Graph relations client↔client (famille, assistant, décideur) |
| Alerting séjour temps réel | Réception réactive plutôt que proactive | Alertes check-in VIP, incident ouvert, préférence critique |
| Campaign attribution loop | ROI marketing non mesurable | Tracking campagne→réservation→revenu→LTV |
| Data residency controls | Exigence groupes internationaux | Paramétrage région stockage + chiffrement champ sensible |
| Feature flags par tenant | Déploiements risqués multi-clients | Flags progressifs par tenant/property |
| Explainable AI panel | Faible confiance sur décisions IA | Affichage facteurs contribuant à score/merge |

---

## CAHIER DES CHARGES TECHNIQUE (pour Codex / Claude)

## A. Schéma BDD (PostgreSQL + Prisma)

### A.1 Conventions globales
- UUID v7 pour PK.
- Colonnes communes: `id`, `tenant_id`, `property_id`, `created_at`, `updated_at`, `created_by`, `updated_by`.
- Soft delete via `archived_at` (jamais delete physique pour entités métier critiques).
- RLS obligatoire sur toutes tables: `tenant_id = current_setting('app.tenant_id')::uuid`.

### A.2 Tables principales

#### `customers`
- `id uuid pk`
- `tenant_id uuid not null`
- `property_id uuid null` (si profil partagé multi-propriétés)
- `external_ref text null`
- `title text null`
- `first_name text null`
- `last_name text null`
- `full_name_search tsvector generated`
- `email citext null`
- `phone_e164 text null`
- `dob date null`
- `nationality text null`
- `language text null`
- `address_json jsonb null`
- `vip_level text null` (enum: NONE, SILVER, GOLD, PLATINUM)
- `loyalty_score int not null default 0`
- `clv_12m numeric(12,2) not null default 0`
- `churn_risk numeric(5,2) null`
- `anonymized boolean not null default false`
- `anonymized_at timestamptz null`
- `anonymization_reason text null`
- `marketing_opt_in boolean not null default false`
- `marketing_opt_in_at timestamptz null`
- `profiling_opt_in boolean not null default false`
- `profiling_opt_in_at timestamptz null`
- `data_retention_until timestamptz null`
- `source_system text null` (PMS, OTA, CRM_IMPORT)
- `merge_master_id uuid null`

Contraintes:
- unique partiel `(tenant_id, email) where email is not null and anonymized=false`
- check anonymized→PII nullifiée via trigger

#### `customer_preferences`
- `id uuid pk`, `customer_id uuid fk`
- `room_floor_pref text null`
- `room_view_pref text null`
- `bed_type_pref text null`
- `allergies text[]`
- `dietary text[]`
- `communication_channel_pref text[]` (EMAIL, SMS, WHATSAPP)
- `housekeeping_pref jsonb`
- `notes_internal text`

#### `customer_tags`
- `id uuid pk`, `tenant_id uuid`
- `name text`, `color text`, `is_system boolean default false`
- unique `(tenant_id, lower(name))`

#### `customer_tag_links`
- `customer_id uuid`, `tag_id uuid`, `assigned_by uuid`, `assigned_at timestamptz`
- pk composite `(customer_id, tag_id)`

#### `customer_segments`
- `id uuid pk`, `tenant_id uuid`
- `name text`, `description text`
- `definition_json jsonb` (DSL filtres)
- `is_dynamic boolean default true`
- `last_computed_at timestamptz`
- `estimated_size int`

#### `customer_segment_members`
- `segment_id uuid`, `customer_id uuid`, `score numeric(8,2) null`, `computed_at timestamptz`
- pk `(segment_id, customer_id)`

#### `customer_incidents`
- `id uuid pk`, `customer_id uuid`
- `category text` (NOISE, DAMAGE, PAYMENT, BEHAVIOR, SERVICE_FAILURE)
- `severity smallint` (1-5)
- `status text` (OPEN, MITIGATED, CLOSED)
- `occurred_at timestamptz`
- `description text`
- `resolution_notes text null`

#### `customer_documents`
- `id uuid pk`, `customer_id uuid`
- `doc_type text` (ID, PASSPORT, CONTRACT, CONSENT_FORM)
- `storage_key text` (object storage)
- `hash_sha256 text`
- `encrypted boolean default true`
- `verified_at timestamptz null`
- `expires_at date null`

#### `customer_communications`
- `id uuid pk`, `customer_id uuid`
- `channel text` (EMAIL, SMS, WHATSAPP, PHONE)
- `direction text` (INBOUND, OUTBOUND)
- `template_id text null`
- `subject text null`
- `content_preview text null`
- `provider_message_id text null`
- `status text` (QUEUED, SENT, DELIVERED, FAILED)
- `sent_at timestamptz null`

#### `customer_duplicates`
- `id uuid pk`, `tenant_id uuid`
- `customer_id_a uuid`, `customer_id_b uuid`
- `match_score numeric(5,2)`
- `match_reasons jsonb` (email_exact, phone_exact, name_fuzzy...)
- `status text` (PENDING, MERGED, REJECTED)
- `reviewed_by uuid null`, `reviewed_at timestamptz null`

#### RGPD additionnelles (fortement recommandées)
- `customer_consents`
- `customer_privacy_requests`
- `customer_anonymization_jobs`

### A.3 Indexation performance
- `GIN (full_name_search)`
- `GIN (to_tsvector('simple', coalesce(email,'') || ' ' || coalesce(phone_e164,'')))`
- `pg_trgm` index sur `first_name`, `last_name`, `email`
- BTREE composites:
  - `(tenant_id, updated_at desc)`
  - `(tenant_id, loyalty_score desc)`
  - `(tenant_id, anonymized, updated_at desc)`

### A.4 Redis
- Cache recherche: `customers:search:{tenant}:{hash_filters}` TTL 60s.
- Locks fusion doublons: `customers:merge:lock:{tenant}:{pair_id}` TTL 30s.

---

## B. API REST (NestJS)

Base path: `/api/v1/customers`

### B.1 CRUD
- `POST /` créer client
- `GET /:id` détail client 360
- `PATCH /:id` mise à jour partielle
- `POST /:id/archive` soft delete logique (si autorisé)
- `POST /:id/anonymize` anonymisation RGPD

### B.2 Recherche avancée
- `GET /search?q=&tags=&segment=&vip=&incidentSeverityMin=&consentMarketing=&page=&pageSize=&sort=`
- Réponse paginée: `{items, total, page, pageSize, facets, kpis}`

### B.3 Doublons
- `GET /duplicates?status=PENDING&minScore=0.75`
- `POST /duplicates/:id/merge` (payload mapping champs + stratégie)
- `POST /duplicates/:id/reject`

### B.4 RGPD
- `POST /:id/export` (job asynchrone)
- `GET /:id/export/:jobId`
- `POST /:id/consents`
- `GET /:id/privacy-requests`

### B.5 Validation Zod (côté API)
- DTO d’entrée validés via `zod` (pipe Nest custom)
- Schémas:
  - `CreateCustomerSchema`
  - `UpdateCustomerSchema`
  - `CustomerSearchSchema`
  - `MergeDuplicateSchema`
  - `AnonymizeCustomerSchema`

### B.6 Contrôles sécurité
- JWT tenant-scoped obligatoire.
- Authorization par rôle (`frontdesk`, `manager`, `dpo`, `marketing`).
- Audit log sur endpoints sensibles (merge, anonymize, export).

---

## C. Frontend React (18 + TS + Tailwind)

## C.1 Arborescence composants
- `CustomersPage`
  - `CustomersHeaderKpis`
  - `CustomersFiltersBar`
  - `CustomerList` (TanStack Table + Virtual)
  - `CustomerDrawer`
    - Onglets (10):
      1. Profil
      2. Séjours
      3. Préférences
      4. Communications
      5. Facturation
      6. Incidents
      7. Documents
      8. Tags & Segments
      9. RGPD
      10. Intelligence (scores & recommandations)
  - `CustomerMergeWizard`
  - `CustomerAnonymizeModal`
  - `CustomerTagsManager`
  - `CustomerSegmentBuilder`

## C.2 Query keys TanStack
- `['customers', 'search', filtersHash]`
- `['customers', customerId]`
- `['customers', customerId, 'communications']`
- `['customers', 'duplicates', filters]`

Mutations invalidant:
- update client → detail + search
- merge duplicate → duplicates + detail + search
- anonymize → detail + search + exports

---

## D. Zustand Store

`useCustomersUiStore`:
- `filters`
- `sort`
- `visibleColumns`
- `savedViews[]`
- `selectedCustomerId`
- `drawerTab`
- `bulkSelection[]`
- actions:
  - `setFilter`, `resetFilters`
  - `saveView`, `deleteView`, `applyView`
  - `selectCustomer`, `setDrawerTab`

`useCustomersCacheStore` (léger, optionnel):
- mémorisation locale des dernières recherches (clé hash)
- invalidation temporelle

---

## E. Règles métier critiques

1. **Anonymisation sans suppression**
- Un client anonymisé conserve identifiants comptables et liens transactionnels.
- Champs PII remplacés par tokens irréversibles.

2. **Détection doublons automatique**
- Exact match prioritaire: email, téléphone.
- Fuzzy match secondaire: nom+prénom + date naissance.
- Score + explication requis avant fusion.

3. **Score fidélité rolling 12 mois**
- Composantes: nuits, revenu net, fréquence, incidents pondérés.
- Recalcul nightly + recalcul à l’événement critique (checkout, remboursement).

4. **Consentement marketing obligatoire**
- Blocage hard des envois commerciaux si `marketing_opt_in=false`.
- Journalisation de toute tentative bloquée.

5. **Immutabilité audit**
- Merge, anonymize, export = entrées audit non modifiables.

---

## F. Plan d’implémentation recommandé

### P0 (6–8 semaines)
- Core data model + RLS + CRUD + recherche virtualisée
- Drawer 10 onglets (MVP fonctionnel)
- RGPD: anonymisation + export + consents
- Duplicate detection rules-based v1

### P1 (4–6 semaines)
- Segment builder dynamique
- Merge wizard assisté + audit enrichi
- Intégration événements réservations/billing/housekeeping

### P2 (4–8 semaines)
- CLV/churn IA
- Next Best Action
- Attribution campagnes et boucle ROI

---

## MOCKUP UI (ASCII)

```text
┌──────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┐
│ FLOWTYM PMS                                                                                                              [⌘K] [User: MGR] │
├───────────────┬───────────────────────────────────────────────────────────────────────────────────────────────┬───────────────────────────────┤
│ SIDEBAR       │ CLIENTS / CARDEX                                                                               │ DRAWER CLIENT                 │
│               │                                                                                                 │                               │
│ • Dashboard   │ KPI: [Clients Actifs 48,320] [VIP 1,842] [Consent OK 82%] [Doublons 1,126] [CLV moyen €1,240] │ [#C-009812] Marie DUPONT      │
│ • Flowday     │                                                                                                 │ Score fidélité: 87/100        │
│ • Planning    │ Filtres: [Recherche ...] [Tags▼] [Segment▼] [Consent▼] [Incident▼] [Sauver vue★]              │ CLV 12m: €4,820               │
│ • Reservations│                                                                                                 │ Churn risk: 0.22              │
│ • Clients     │ ┌─────────────────────────────────────────────────────────────────────────────────────────────┐ │ ---------------------------  │
│   - Cardex    │ │ Nom            Email               Tél            VIP  Score  Consent  Segments  Doublons │ │ Onglets:                    │
│   - Segments  │ │─────────────────────────────────────────────────────────────────────────────────────────────│ │ [Profil] [Séjours]          │
│   - Campagnes │ │ Dupont, Marie  m.dup@...           +33...         G    87     Oui      4         1        │ │ [Préférences] [Comms]       │
│ • Housekeeping│ │ Smith, John    j.smith@...         +44...         P    93     Oui      7         0        │ │ [Facturation] [Incidents]   │
│ • Billing     │ │ ... (virtualized rows, 100k+) ...                                                     │ │ [Documents] [Tags]         │
│ • Finance     │ └─────────────────────────────────────────────────────────────────────────────────────────────┘ │ [RGPD] [Intelligence]        │
│ • Settings    │                                                                                                 │                               │
│               │ Actions bulk: [Tagger] [Exporter] [Fusionner] [Assigner]                                        │ Aperçu onglet “Profil”        │
│               │                                                                                                 │ - Identité vérifiée ✅         │
│               │                                                                                                 │ - Préf chambre: étage haut    │
│               │                                                                                                 │ - Allergie: gluten            │
│               │                                                                                                 │ - Dernier incident: mineur    │
│               │                                                                                                 │                               │
│               │                                                                                                 │ CTA: [Fusion doublon]         │
│               │                                                                                                 │      [Anonymiser RGPD]        │
│               │                                                                                                 │      [Exporter données]       │
├───────────────┴───────────────────────────────────────────────────────────────────────────────────────────────┴───────────────────────────────┤
│ Status: Realtime sync OK • RLS tenant=HOTEL_FR_017 • Last segment recompute: 02:14 UTC                                                            │
└──────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## PRIORITÉS DE DÉVELOPPEMENT

| Priorité | Module | Délai estimé |
|----------|--------|---------------|
| P0 | Data model clients + RLS + API CRUD/search + UI list virtualisée | 3 semaines |
| P0 | RGPD (consentements, anonymisation irréversible, export DSAR) | 2 semaines |
| P0 | Drawer client 10 onglets + intégration réservations/billing incidents | 3 semaines |
| P1 | Détection doublons + Merge Wizard assisté | 2 semaines |
| P1 | Segment Builder + vues sauvegardées + tags dynamiques | 2 semaines |
| P2 | Scoring IA CLV/churn + Next Best Action | 4 semaines |
| P2 | Attribution campagnes et boucle ROI CRM | 2 semaines |

