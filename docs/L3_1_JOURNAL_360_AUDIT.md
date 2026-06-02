# L3.1 — Journal Client 360° — Rapport d'audit (AVANT implémentation)

> **Statut : EN ATTENTE DE VALIDATION.** Aucune ligne de code applicatif n'est
> écrite. Ce document couvre les 9 livrables Phase 7 + les audits Phases 1‑6.
> **Hors périmètre (rappel)** : pas de L5 CRM, pas de L6 Automatisation, aucune
> nouvelle fonctionnalité tant que le Journal n'est pas finalisé.

---

## 1. RAPPORT D'AUDIT (Phases 1‑6)

### 1.1 Sources capables d'alimenter le Journal

| Catégorie | Source réelle | État |
|-----------|---------------|------|
| Communication (out) | `conversation_messages` (L2) + `communication_logs` (anti‑jointure) | ✅ en place (L3) |
| Communication (in) | idem (`direction='inbound'`, `delivered/read`) | 🟡 schéma prêt, données via webhooks **L7** |
| CRM — badges | `guest_badge_history` | ✅ en place (L3) |
| CRM — incidents | `guest_incidents` | ✅ en place (L3, table idempotente) |
| Notes internes | `communication_internal_notes` | ✅ en place (L3) |
| **Cycle de vie réservation** | **`audit_logs`** (entity=`reservation`) | ✅ existe, **non encore branché** |
| **Finance** | `payments`, `invoices`, `invoice_lines`, `credit_notes`, `deposits` | ✅ existent, **non branchés** |
| **Tarifaire** | `rms_decisions` (par type/date) + `audit_logs` payload | 🟡 partiel |
| **Pièces jointes** | *(rien)* — à créer (`communication_attachments` + Storage) | ❌ à construire |

**Table pivot des événements PMS — `public.audit_logs`** (immuable)
`frontend/supabase/migrations/0010_flowtym_align.sql:80`
```
id, hotel_id, actor_user_id → users.id, entity, entity_id, action,
payload jsonb, correlation_id, created_at
index (hotel_id, created_at DESC) · index (entity, entity_id)
```
Trigger réservation (`0030_reservations_audit_locking.sql:19`) écrit des **actions sémantiques** :
`INSERT`, `STATUS_CHECKED_IN`, `STATUS_CHECKED_OUT`, `STATUS_CANCELLED`,
`STATUS_NO_SHOW`, `STATUS_CONFIRMED`, `UPDATE`, `DELETE`, avec `payload`
contenant `room_id`/`status`/`total_amount` avant‑après → permet de **dériver**
changement de chambre et modification tarifaire.

> `audit_logs` ne porte pas `guest_id` (seulement `entity_id`). Le rattachement
> au client se fait par jointure `reservations r ON r.id = entity_id`. La RPC
> agrégatrice (SECURITY DEFINER) lira `audit_logs` en contournant la RLS, avec
> filtrage explicite `hotel_id`.

### 1.2 / 1.3 Points d'ouverture — fiche réservation & fiche client (audit UUID)

**Fiche réservation = `ReservationDetailsModal` (8 appelants).** Une seule existe
(pas de modal concurrent). État de propagation des UUID réels :

| Appelant | reservation UUID | guest UUID | Cause racine |
|----------|:---:|:---:|--------------|
| `components/today/OperationsTable.tsx` | ✅ `reservationUuid` | ✅ `guestId` | OK (câblé en L3) |
| `pages/ReservationsView.tsx` | ❌ | ❌ | `mapRow()` n'extrait pas `guest_id`; `id` non exposé en `reservationUuid` |
| `pages/PlanningViewLive.tsx` | ❌ | ❌ | type `Reservation` (contexte) sans ces champs |
| `pages/reservations/GroupesView.tsx` | ❌ | ❌ | `toModalRes()` omet `guest_id`/`id` |
| `pages/reservations/ResPaymentsView.tsx` | ❌ | ❌ | idem `toModalRes()` |
| `pages/reservations/ResAnomaliesView.tsx` | ❌ | ❌ | idem |
| `pages/reservations/ResFilteredView.tsx` | ❌ | ❌ | passe `selectedRow as any` (non mappé) |
| `pages/reservations/ResRelancesView.tsx` | ❌ | ❌ | idem `toModalRes()` |

**Fiche client = `ClientProfile360` (1 appelant principal).**

| Appelant | guest UUID | État |
|----------|:---:|------|
| `pages/ClientsView.tsx` | ✅ `guestId` (issu de `useGuests()`) | OK |

**Constat clé** : la donnée existe presque partout en amont — `ReservationRow`
(`domains/reservations/schemas.ts`) possède `id` (UUID résa) et `guest_id`
(nullable). Le problème est **uniquement de la plomberie de mappers/types** qui
laisse tomber ces champs. C'est ce qui produit « UUID non disponible depuis
cette vue ». **Aucun blocage de fond.**

### 1.4 Événements PMS déjà disponibles en base → voir §2.

### Phase 4 — Filtres (conception)
Vues (catégorie portée par chaque entrée) : **Tous · Communication · CRM ·
Réservation · Finance · Incidents · Notes internes**. Plus : **recherche texte**,
**filtre période** (du/au), **filtre utilisateur** (acteur), **filtre canal**
(email/sms/whatsapp/internal). Tous appliqués **côté serveur** (paramètres RPC)
pour rester performants sur 5 ans d'historique.

### Phase 6 — Stratégie UUID (source unique)
Objectif : supprimer 100 % des « UUID non disponible ». Plan : faire remonter
`guest_id` + `reservation_id` (= `ReservationRow.id`) depuis la donnée jusqu'au
modal dans les 8 appelants, via :
1. Étendre `ResTableRow` (et types dérivés) avec `guestId` + `reservationUuid`.
2. Compléter `mapRow()` / `toModalRes()` (5 vues réservations) pour propager
   `guest_id` et `id`.
3. Étendre le type `Reservation` (contexte) + l'hydratation Planning.
4. `ReservationDetailsModal` lit déjà `res.guestId ?? res.guest_id` /
   `res.reservationUuid ?? res.reservation_id` → **aucun changement** côté modal.
Résultat : **une seule** fiche réservation, **une seule** fiche client, UUID
disponibles partout.

---

## 2. LISTE DES ÉVÉNEMENTS PMS DISPONIBLES

| # | Événement | Source | Horodatage | resa_id | guest_id | acteur | Confiance |
|---|-----------|--------|-----------|:---:|:---:|:---:|-----------|
| 1 | Réservation créée | `audit_logs` `reservation/INSERT` | created_at | entity_id | via join | actor_user_id | ✅ |
| 2 | Réservation modifiée | `audit_logs` `reservation/UPDATE` | created_at | entity_id | join | ✓ | ✅ |
| 3 | Changement de chambre | `audit_logs` UPDATE + diff `payload.room_id` | created_at | entity_id | join | ✓ | ✅ (dérivé) |
| 4 | Surclassement | dérivé du changement de type de chambre | created_at | entity_id | join | ✓ | 🟡 (heuristique) |
| 5 | Délogement (walk) | pas de statut dédié | — | — | — | — | 🟡 (à expliciter) |
| 6 | Check‑in | `audit_logs` `STATUS_CHECKED_IN` | created_at | entity_id | join | ✓ | ✅ |
| 7 | Check‑out | `STATUS_CHECKED_OUT` | created_at | entity_id | join | ✓ | ✅ |
| 8 | Annulation | `STATUS_CANCELLED` | created_at | entity_id | join | ✓ | ✅ |
| 9 | No‑show | `STATUS_NO_SHOW` | created_at | entity_id | join | ✓ | ✅ |
| 10 | Paiement enregistré | `payments` (status=completed) | collected_at/created_at | via `invoices` | via invoice | created_by | ✅ |
| 11 | Remboursement | `payments` (reversal) + `credit_notes` | created_at | via invoice/cn | ✓ | created_by | ✅ |
| 12 | Facture générée | `invoices` (issued) | issued_at/created_at | reservation_id | guest_id | created_by | ✅ |
| 13 | Facture envoyée | **dérivé** `communication_*` (template=invoice) | sent_at | reservation_id | guest_id | created_by | 🟡 (pas de `sent_at` sur invoices) |
| 14 | Modification tarifaire | `audit_logs` UPDATE (diff total/rate_plan) + `rms_decisions` | created_at | entity_id | join | ✓ | 🟡 (RMS non lié à la résa) |
| 15 | Ajout prestation | `invoice_lines` INSERT | created_at | via invoice | via invoice | created_by | ✅ |
| 16 | Suppression prestation | `invoice_lines` `source='reversal'` | created_at | via invoice | via invoice | created_by | ✅ |

**Tables candidates (resa_id|guest_id + created_at)** : `audit_logs`,
`payments`, `invoices`, `invoice_lines`, `credit_notes`, `deposits`,
`conversation_messages`, `communication_logs`, `guest_badge_history`,
`guest_incidents`, `communication_internal_notes`.

**Décisions à valider (§ ouvertes #1)** pour les événements 🟡 :
- **Surclassement / Délogement** : démarrer en *dérivé best‑effort* (sur diff de
  type de chambre / sortie anticipée) + possibilité d'ajouter plus tard un
  marquage explicite (colonne/évènement manuel). OK ?
- **Facture envoyée** : dériver de la communication (un email avec
  `template_kind='invoice'`) plutôt que d'ajouter `invoices.sent_at` maintenant. OK ?
- **Modification tarifaire** : par réservation via `audit_logs` (diff montant /
  rate_plan). `rms_decisions` (macro, par type/date) **exclu** de la timeline
  client. OK ?

---

## 3. ARCHITECTURE DES PIÈCES JOINTES (`communication_attachments`)

État actuel : **aucun** stockage (Supabase Storage non utilisé), uploads
actuels uniquement en mémoire (CardexDocument). Tout est à construire.

### Table
```sql
CREATE TABLE public.communication_attachments (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  hotel_id             uuid NOT NULL REFERENCES public.hotels(id) ON DELETE CASCADE,
  -- rattachements (au moins un)
  message_id           uuid REFERENCES public.conversation_messages(id) ON DELETE CASCADE,
  communication_log_id uuid REFERENCES public.communication_logs(id)    ON DELETE SET NULL,
  guest_id             uuid REFERENCES public.guests(id)        ON DELETE SET NULL,
  reservation_id       uuid REFERENCES public.reservations(id)  ON DELETE SET NULL,
  -- fichier
  storage_bucket       text NOT NULL DEFAULT 'communication-attachments',
  storage_path         text NOT NULL,           -- {hotel_id}/{guest_id|resa}/{uuid}/{filename}
  original_filename    text NOT NULL,
  mime_type            text NOT NULL,
  size_bytes           bigint NOT NULL,
  kind                 text,                     -- invoice|contract|quote|id_doc|email_in|email_out|other
  direction            text,                     -- inbound|outbound|internal
  uploaded_by          uuid REFERENCES public.users(id) ON DELETE SET NULL,
  created_at           timestamptz NOT NULL DEFAULT now()
);
-- index (hotel_id, created_at DESC), (guest_id), (reservation_id), (message_id)
-- RLS : SELECT hôtel-scopé ; écriture via RPC register_attachment (SECURITY DEFINER)
```
Champs demandés couverts : **nom (`original_filename`), taille (`size_bytes`),
type (`mime_type`/`kind`), date (`created_at`), utilisateur (`uploaded_by`),
réservation (`reservation_id`), client (`guest_id`)**.

### Supabase Storage
- Bucket **privé** `communication-attachments`.
- Convention de chemin : `{hotel_id}/{guest_id}/{attachment_uuid}/{filename}`.
- **RLS sur `storage.objects`** : lecture/écriture autorisées si
  `foldername(name)[1] = get_user_hotel_id()::text` (isolation multi‑tenant).
- Upload : front → `supabase.storage.upload()` (chemin hôtel‑scopé) → RPC
  `register_attachment(...)` insère la métadonnée. Download : `createSignedUrl()`
  (URL temporaire). Suppression : RPC `delete_attachment` (storage + ligne).
- **Compatibilité** : PDF, factures, contrats, devis, pièces d'identité,
  documents clients, fichiers email (in/out). Validation type + taille (limite à
  fixer, ex. 25 Mo).
- **Affichage timeline** : la RPC `communication_timeline` agrège les pièces
  jointes (par `message_id` et par `guest_id/reservation_id` pour les pièces
  autonomes) dans le champ `attachments` déjà prévu.

**Décision à valider (#2)** : périmètre L3.1 = **stockage + upload manuel +
affichage timeline + download signé**. L'**envoi** de pièces jointes par email
(providers) et la **réception** (email entrant) dépendent de l'évolution
edge‑functions / webhooks **L7** → traités hors L3.1. OK ?

---

## 4. IMPACT BASE DE DONNÉES

Tout **additif**, une migration `20260631_journal_360.sql` :
1. `communication_attachments` (+ RLS + index).
2. Bucket Storage `communication-attachments` + policies `storage.objects`.
3. RPC `register_attachment` / `delete_attachment` (SECURITY DEFINER, hôtel‑scopé).
4. **Nouvelle** RPC `communication_timeline_v2(p_guest_id, p_reservation_id,
   p_categories text[], p_channels text[], p_actor uuid, p_from timestamptz,
   p_to timestamptz, p_search text, p_limit, p_before)` :
   - reprend les 5 sources L3 + ajoute **audit_logs (réservation)**, **payments**,
     **invoices**, **invoice_lines**, **credit_notes**, **deposits**, et joint
     **communication_attachments** ;
   - chaque ligne reçoit une **`category`** (communication|crm|reservation|finance|incident|note) ;
   - applique tous les filtres serveur + keyset.
   - `communication_timeline` (v1) **conservée** le temps de basculer l'UI.
5. *(optionnel, différé)* index supplémentaires sur `payments`/`invoice_lines`
   si EXPLAIN le justifie.

**Aucune** suppression. `communication_logs`, `audit_logs`, finance : intacts.

> Risque connu (à noter) : `audit_logs`/finance vivent dans
> `frontend/supabase/migrations` (legacy) et les RPC récentes dans
> `supabase/migrations`. La RPC v2 référence ces tables : OK sur la base
> déployée (elles existent), mais un rebuild *from scratch* depuis le seul
> dossier racine échouerait. Recommandation : documenter l'ordre d'application
> (legacy puis récent) — sans changement destructif.

## 5. IMPACT FRONTEND

- **`CommunicationTimeline`** enrichi : barre de filtres (catégories en onglets,
  recherche, période, utilisateur, canal), rendu par **catégorie** (icônes :
  réservation, finance, etc.), rendu des **pièces jointes** (download signé).
- **Pagination/lazy** : passage à `useInfiniteQuery` (react‑query v5, déjà
  présent) + sentinelle IntersectionObserver.
- **Virtualisation** : `@tanstack/react-virtual` (déjà en dépendances) pour la
  liste (fluide à plusieurs centaines/milliers d'entrées).
- **Upload** : hook `useUploadAttachment` + composant `AttachmentPicker`
  (drag‑drop, réutilise le pattern existant) dans la timeline et la fiche.
- **Phase 6 UUID** : MAJ de `ResTableRow` + `mapRow()`/`toModalRes()` (5 vues),
  type `Reservation` (contexte) + Planning → propagation `guestId`/`reservationUuid`.
- **Service** : `timeline.service.ts` pointe vers `communication_timeline_v2`,
  types étendus (`category`, filtres) ; `attachments.service.ts` (upload/list/delete).

## 6. IMPACT BACKEND (edge functions / RPC)

- **Pas de nouvelle edge function obligatoire** : upload direct via
  `supabase.storage` (RLS) + RPC `register_attachment`. Download via signed URL.
- RPC `communication_timeline_v2` (agrégateur étendu) + `register_attachment` +
  `delete_attachment`.
- `send-email` : **inchangé en L3.1** (envoi de pièces jointes par email = L7).

## 7. IMPACT PERFORMANCES

- **Pagination keyset** (`occurred_at, entry_id < p_before`) → pages O(limit),
  pas d'OFFSET. Page 30‑50.
- **Lazy loading** : `useInfiniteQuery` + IntersectionObserver ; chargement
  uniquement à l'ouverture (section/onglet/drawer), jamais sur les listes.
- **Virtualisation** : `@tanstack/react-virtual` → DOM borné quel que soit le
  volume (5 ans, centaines d'événements + messages).
- **Index** : `audit_logs(hotel_id, created_at DESC)` existe ; sources finance
  filtrées par resa/guest + bornées par keyset. Vérification EXPLAIN au build.
- **Filtres serveur** (catégorie/canal/période/acteur/recherche) → moins de
  données transférées.
- **Coût** : la v2 fait N SELECT indexés bornés + tri/merge limité ; bornée par
  client/réservation. Acceptable.

## 8. STRATÉGIE DE MIGRATION

Approche **expand‑only**, sans rupture :
1. Migration additive (table attachments, bucket, RPC v2) — réversible.
2. UI bascule progressivement de `communication_timeline` (v1) vers v2
   (comparaison possible côte à côte).
3. Plomberie UUID livrée en parallèle (purement additive sur les types/mappers).
4. v1 conservée jusqu'à validation complète, puis dépréciée (non supprimée sans
   accord).
5. Aucun backfill nécessaire (la v2 lit les tables vivantes en place).

## 9. PLAN DE ROLLBACK

| Niveau | Action | Effet |
|--------|--------|-------|
| RPC v2 | `DROP FUNCTION communication_timeline_v2…` ; l'UI rebascule sur v1 | retour L3 |
| Attachments | `DROP TABLE communication_attachments` + suppression policies bucket (le bucket peut être conservé vide) | aucune donnée legacy touchée |
| Storage | bucket isolé ; suppression manuelle si voulu | sans impact métier |
| Frontend | composants/hook additifs ; types UUID additifs → suppression inerte | aucun impact |
| Fichier | `supabase/rollback/20260631_journal_360_rollback.sql` (hors migrations/) | retour propre |

Rollback **sûr par construction** : les objets L3.1 ne sont référencés par
aucune table legacy (FK toujours *depuis* L3.1 *vers* l'existant).

---

## DÉCISIONS À VALIDER AVANT IMPLÉMENTATION
1. **Événements 🟡** : surclassement/délogement en *dérivé best‑effort* ; facture
   envoyée via lien communication ; modif tarifaire via `audit_logs` (RMS exclu). 
2. **Pièces jointes L3.1** = stockage + upload manuel + affichage + download ;
   envoi/réception par email différés en L7.
3. **UUID Phase 6** : refactor des 8 points d'ouverture en L3.1 (supprime
   définitivement « UUID non disponible »).
4. **RPC** : nouvelle `communication_timeline_v2` (v1 conservée) plutôt que
   modifier la RPC existante.
5. **Ordre de livraison** suggéré : (a) UUID Phase 6 → (b) RPC v2 + événements
   PMS/finance → (c) pièces jointes → (d) filtres + perf (pagination/virtualisation).
