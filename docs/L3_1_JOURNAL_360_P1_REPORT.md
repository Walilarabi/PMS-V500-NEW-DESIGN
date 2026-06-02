# P1 — Pagination composite + Audit de couverture du Journal 360°

> Correctifs appliqués **en production** (`flowtym-housekeeping`) et **dépôt aligné**
> (`20260632_journal_360_composite_cursor.sql`). Validation réelle effectuée,
> données de test nettoyées. **Aucune nouvelle fonctionnalité** (pas de SMS/CRM
> avancé/Automatisation/Webhooks).

---

## 1. Correction pagination — curseur composite

**Problème** : curseur basé sur `occurred_at` seul. Plusieurs événements partageant
le même instant (check-in + paiement + email + note + badge à la même seconde)
→ après la 1ʳᵉ page, la condition `occurred_at < p_before` **exclut tout le
groupe** → doublons / pertes / ordre instable.

**Solution livrée** : curseur **composite `(occurred_at, entry_id)`**.
- Paramètres RPC : `p_before` (timestamptz) → remplacé par `p_before_at` + `p_before_id`.
- Condition : `occurred_at < p_before_at OR (occurred_at = p_before_at AND entry_id < p_before_id)`.
- Tri inchangé : `ORDER BY occurred_at DESC, entry_id DESC`.
- `entry_id` (uuid unique global) garantit un **ordre total déterministe**.
- Frontend : `useTimeline360` (useInfiniteQuery) renvoie un curseur `{at, id}` ;
  `fetchTimeline360` transmet `beforeAt`/`beforeId`. Tests unitaires ajoutés.

**Garanties** : aucun doublon · aucune perte · ordre stable · pagination déterministe.

## 2. Résultat de la recette (P1.1) — preuve réelle

Scénario : **7 événements au même timestamp exact** (5 notes + 1 badge + 1 WhatsApp,
tous à `2026-06-15 10:00:00`), pagination **page size = 2**, boucle jusqu'à épuisement :

| Attendu | Affiché | Distincts | Doublons | Pages | Séquence |
|:---:|:---:|:---:|:---:|:---:|---|
| 7 | **7** | **7** | **0** | 4 | 2 + 2 + 2 + 1 |

→ **Aucun événement perdu, aucun doublon**, sur des entrées au timestamp identique.
(Données de test supprimées après validation.)

## 3. Audit de couverture fonctionnelle (P1.2)

| Événement métier | Source réelle | Traçable | Commentaire | Action corrective |
|------------------|---------------|:---:|-------------|-------------------|
| Réservation créée | `audit_logs` (created/INSERT) | ✅ | acteur souvent « Système » (création auto/import/OTA) | enrichir acteur (cf. §5) |
| Réservation modifiée | `audit_logs` (updated) | ✅ | — | — |
| Check-in | `audit_logs` updated, `diff.status[_,checked_in]` | ✅ | rare dans le seed (1) mais mapping prouvé | — |
| Check-out | `audit_logs` `CHECKOUT` / updated→checked_out | ✅ | — | — |
| Annulation | updated `diff.status[_,cancelled]` | ✅ | — | — |
| No-show | updated `diff.status[_,no_show]` | ✅ | — | — |
| Paiement | `payments` | ✅ (branche) | 0 paiement dans l'hôtel testé → à confirmer en UI réelle | tester avec un paiement réel |
| Remboursement | `payments` (reversed / reversal_of / montant<0) | ✅ | — | — |
| Facture | `invoices` (+ avoir si `credit_note_of`) | ✅ | **pas d'acteur** (`invoices` sans `created_by`) → « Système » | ajouter `created_by` (hors scope) |
| Email envoyé | `conversation_messages` / `communication_logs` | ✅ | nécessite l'envoi via `send-email` (non déployée) | déployer `send-email` |
| WhatsApp envoyé | idem | ✅ | `send-whatsapp` déployée | — |
| Badge ajouté/retiré | `guest_badge_history` | ✅ | transition affichée | — |
| Note interne | `communication_internal_notes` | ✅ | — | — |
| Modification tarifaire | updated `diff.total_amount` | ✅ | transition « old € → new € » | — |
| Ajout prestation | `invoice_lines` (source≠reversal) | ✅ | — | — |
| Suppression prestation | `invoice_lines` (source=reversal) | ✅ | — | — |
| **Changement de chambre** | — | ❌ **NON** | `diff` ne contient pas `room_id` (non tracé) | cf. §4 |
| **Surclassement** | — | ❌ **NON** | aucune notion d'upgrade en base | cf. §4 |
| **Délogement (walk)** | — | ❌ **NON** | aucun statut/flag « walk » | cf. §4 |

**Bilan : 15/18 traçables**, 3 angles morts (changement de chambre, surclassement, délogement).

## 4. Événements non traçables — analyse (P1.3, aucun code)

### 4.1 Changement de chambre
1. **Pourquoi** : le trigger d'audit `updated` ne met pas `room_id` dans `payload.diff` (clés réelles : status, total_amount, guest_id, no_show_at).
2. **Où l'info manque** : `audit_logs.payload.diff` (pas de room_id).
3. **Table cible** : `reservations.room_id` (la valeur existe) ; le **changement** n'est pas journalisé.
4. **Mécanisme** : étendre le trigger d'audit réservation pour inclure `room_id` dans le diff **ou** créer une table `reservation_room_changes(reservation_id, old_room, new_room, changed_by, at)`.
5. **Impact Frontend** : nouvelle branche/libellé « Changement de chambre » (déjà prévu côté RPC, il suffira d'alimenter).
6. **Impact Backend** : modifier le trigger d'audit (ou ajouter un trigger sur `reservations.room_id`).
7. **Impact BDD** : soit modification trigger (0 nouvelle table), soit 1 table d'historique + index.

### 4.2 Surclassement (upgrade)
1. **Pourquoi** : aucune notion métier « upgrade » (changement de type de chambre supérieur) tracée ; non distinguable d'un simple changement de chambre.
2. **Où** : nécessiterait de comparer la catégorie réservée vs attribuée.
3. **Table cible** : `reservations` (room_type réservé vs room attribué) — donnée partielle.
4. **Mécanisme** : règle métier comparant catégories + journalisation dédiée (flag `is_upgrade` ou événement).
5. **FE** : libellé « Surclassement ».
6. **BE** : logique de détection au check-in/attribution.
7. **BDD** : colonne/flag ou table d'événements upgrade.

### 4.3 Délogement (walk)
1. **Pourquoi** : aucun statut/action « walk » ; un délogement ressemble à un check-out anticipé ou une réaffectation.
2. **Où** : non capturé.
3. **Table cible** : `reservations` (aucun champ dédié).
4. **Mécanisme** : action explicite « walk » dans le flux opérationnel + journalisation (audit action `WALK` ou table dédiée).
5. **FE** : libellé « Délogement ».
6. **BE** : nouvelle action métier + écriture audit.
7. **BDD** : valeur d'action `WALK` (aucune table si via audit_logs).

> Ces 3 événements **n'existent pas en base** aujourd'hui — ce sont des **angles
> morts d'instrumentation PMS**, pas des bugs du Journal. Aucune implémentation
> à ce stade (audit uniquement).

## 5. Analyse des acteurs (P1.4)

Données réelles (hôtel test, `audit_logs` réservation, 1263 événements) :
- **Avec acteur humain** (`actor_user_id` = `users.id`) : **476** (1 utilisateur distinct dans le seed) → nom affiché (ex. « Wali Larabi »).
- **Sans acteur** : **787 (62 %)** → affichés « Système » : créations automatiques, bascules no-show automatisées, imports, RMS.

| Type d'acteur | Représenté ? | Source | Verdict |
|---------------|:---:|--------|---------|
| Utilisateur humain | ✅ | `users.full_name` via `users.id` | OK (corrigé en P0) |
| Système / automation | ✅ | `actor_user_id` NULL → « Système » | OK |
| API / Flowtym Automation | ⚠️ | non distingué → « Système » | ambigu (pas de marqueur) |
| **OTA (Booking, Expedia, Agoda…)** | ❌ | `reservations.source` existe (Booking.com 157, Expedia 53, Agoda, Ctrip…) **mais non utilisé** comme acteur | **ambigu** : réservation OTA → « Système » au lieu de « Booking.com » |
| Channel Manager | ❌ | non distingué | ambigu |

**Cas ambigus identifiés** :
1. **Réservations OTA** créées via Booking/Expedia → acteur « Système » alors que la source est connue (`reservations.source`).
2. **Factures** : aucun acteur (`invoices` sans `created_by`) → « Système ».
3. **Bascules no-show automatisées** : portent l'`actor_user_id` du batch (peut sembler être un humain alors que c'est automatisé).

**Recommandation (non implémentée)** : pour les événements `Réservation créée` sans
acteur humain, **dériver l'acteur depuis `reservations.source`** (afficher
« Booking.com », « Expedia »… ) ; sinon « Système ». Marquer distinctement les
automatisations Flowtym (ex. via un compte technique dédié).

## 6. Recommandations

| Priorité | Recommandation |
|----------|----------------|
| ✅ Fait | Curseur composite (P1) — pagination déterministe validée. |
| Moyenne | **Déployer `send-email`** (`supabase functions deploy`) → traçabilité email complète. |
| Moyenne | **Enrichir l'acteur OTA** (créations) depuis `reservations.source`. |
| Basse | Corriger le bug de CTE non nommée dans `communication_timeline` (v1, non utilisée). |
| Plus tard | Instrumenter **changement de chambre / surclassement / délogement** (trigger/flag/table) — angles morts PMS. |
| Plus tard | Ajouter `invoices.created_by` pour l'acteur des factures. |
| Suivant | **P2** (tests de charge 100/500/1000/5000) · **P3** (durcissement `register_attachment`). |

---

## Synthèse — ce que le Journal 360° sait faire aujourd'hui

- **Sait faire** : timeline unique chronologique **déterministe** (pagination
  composite), agrégeant réservation (créée/modifiée/check-in/check-out/annulation/
  no-show/modif tarifaire), finance (paiement/remboursement/facture/avoir/
  prestations), communication (email/WhatsApp), CRM (badges/incidents), notes,
  pièces jointes ; acteur humain ou « Système » ; isolation multi-hôtels (RLS).
- **Ne sait pas faire** : changement de chambre, surclassement, délogement
  (non tracés en base) ; distinguer OTA/Channel Manager/API comme acteur.
- **À ajouter plus tard** : instrumentation des 3 angles morts, enrichissement
  acteur OTA, déploiement `send-email`, P2/P3.

**Statut P1 : livré et validé en réel.** En attente de votre validation avant
toute autre évolution (P2/P3 ou autre).
