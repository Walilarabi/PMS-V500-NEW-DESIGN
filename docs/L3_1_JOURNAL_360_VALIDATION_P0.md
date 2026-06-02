# P0 — Clôture : Journal 360° aligné sur le schéma réel + validation

> Toutes les corrections appliquées **directement sur la production**
> `flowtym-housekeeping` (`hzrzkvdebaadditvbqis`), **la production étant la
> source de vérité**. Recette refaite en réel (impersonation), données de test
> nettoyées (vérifié : 0). Le fichier dépôt `20260631_journal_360.sql` a été
> ré-aligné sur la version corrigée.

---

## P0.1 — Showstopper finance (corrigé)

`communication_timeline_v2` levait `ERROR 42703` et **échouait entièrement**.
Deux causes réelles :
- `invoices.created_by` **n'existe pas** en prod → branche factures invalide.
- **Colonnes de CTE non nommées** → `u.entry_type` introuvable (bug latent qui
  aurait cassé la RPC même après le fix finance).

**Corrigé** : branche `invoices` sans `created_by` (acteur NULL, `credit_note_of`
→ « Avoir ») ; CTE déclarée avec ses 14 colonnes nommées. La RPC s'exécute
désormais **sans erreur** (prouvé en réel).

## P0.2 — Événements PMS (table de correspondance, construite sur le réel)

Vocabulaire réel observé dans `audit_logs` (entity=reservation) :
`created`, `updated`, `deleted`, `CHECKOUT`, `CHECKOUT_HK_CREATED`, `INSERT`.

| Action réelle | Libellé métier |
|---------------|----------------|
| `created` / `INSERT` | Réservation créée |
| `updated` + `diff.status=[_, checked_in]` | Check-in |
| `updated` + `diff.status=[_, checked_out]` / `CHECKOUT` | Check-out |
| `CHECKOUT_HK_CREATED` | Check-out · ménage planifié |
| `updated` + `diff.status=[_, cancelled]` | Annulation |
| `updated` + `diff.status=[_, no_show]` | No-show |
| `updated` + `diff.status=[_, confirmed]` | Réservation confirmée |
| `updated` + `diff.total_amount` | Modification tarifaire |
| `updated` + `diff.guest_id` | Réservation modifiée (client) |
| `updated` (autre) | Réservation modifiée |
| `deleted` | Réservation supprimée |

**Preuve (distribution réelle, hôtel test, 0 libellé générique)** : Réservation
créée 359 · Réservation modifiée (client) 342 · No-show 273 · Réservation
confirmée 183 · Modification tarifaire 88 · Annulation 6 · Check-out 6 ·
Réservation supprimée 4 · Check-in 1 · Réservation modifiée 1.

## P0.3 — Payloads (parsing basé sur la réalité)

Structures réelles : `created` → `{after}` ; `updated` → `{diff:{champ:[old,new]}}` ;
`CHECKOUT` → `{checked_out_at, previous_status, …}`. **Plus aucune hypothèse
`before/after`.** Le statut se lit dans `payload->'diff'->'status'->>1` (tableau
`[ancien, nouveau]`) ; le corps affiche la transition (ex. « confirmed → no_show »,
« 0 € → 740,13 € »). À noter : `diff` ne contient **pas** `room_id` → le
changement de chambre n'est pas dérivable de l'audit (non tracé).

## P0.4 — Utilisateurs (acteur corrigé)

`audit_logs.actor_user_id` correspond à **`users.id`** (vérifié : 0 match sur
`auth_id`, 0 sur `auth.users`). Jointure corrigée → l'acteur s'affiche
(ex. **No-show : 272/273 avec acteur**, vs 0 avant). Les changements automatisés
(import, RMS, sync) restent sans acteur → « Système » (comportement attendu).

## P0.5 — Alignement dépôt ↔ production

| Objet | Dépôt Git | Production (réel) | Verdict |
|-------|-----------|-------------------|---------|
| `invoices.created_by` | présent (`0080_billing`) | **ABSENT** | dépôt **faux** |
| `invoices` (colonnes) | ~13 | ~30 (`invoice_type`, `guest_name`, `pdp_status`, `credit_note_of`, `signature_data`, …) | dépôt **incomplet** |
| `payments` (colonnes) | base | + `payment_method`, `payment_date`, `transaction_id`, `payment_type`, `reservation_id` direct | dépôt **incomplet** |
| Trigger audit réservation | `INSERT`/`STATUS_*` (`0030`) | `created`/`updated`/`deleted`/`CHECKOUT`/`CHECKOUT_HK_CREATED` | dépôt **obsolète/faux** |
| Payload audit | `before`/`after` | `after` / `diff` | dépôt **faux** |
| `audit_logs.actor_user_id` | `auth.uid()` | `users.id` | dépôt **faux** |
| Plateforme Communication L1→L3.1 | dans le dépôt | **n'était pas déployée** | comblé (5 migrations appliquées) |
| `guest_incidents` | créée par migration | **préexistait** (même schéma) | no-op ✅ |
| CTE colonnes nommées (v1 & v2) | **manquant** (bug) | corrigé en **v2** | v1 (`communication_timeline`) **reste à corriger** (non utilisée par le Journal) |
| `get_user_hotel_id` | suppose `users.hotel_id` | hôtel **actif/membership** | info |

**Recommandation** : considérer les fichiers legacy `0030_*`/`0080_billing` du
dépôt comme **non fiables** ; régénérer les types/migrations de référence depuis
la prod. Éviter tout nouveau développement basé sur ces fichiers.

---

## Validation (recette réelle refaite)

| Scénario | Résultat via la **vraie** `communication_timeline_v2` |
|----------|-------------------------------------------------------|
| Réservation créée | ✅ « Réservation créée » |
| Réservation modifiée | ✅ « Réservation modifiée » / « (client) » / « Modification tarifaire » |
| Check-in | ✅ libellé « Check-in » (mapping prouvé ; rare dans le seed : 1) |
| Check-out | ✅ « Check-out » (6) |
| Annulation | ✅ « Annulation » (6) |
| No-show | ✅ « No-show » (273) + transition |
| Paiement | ⚙️ branche OK (colonnes réelles, fonction sans erreur) — **0 paiement dans l'hôtel test** → à confirmer en test UI dès qu'un paiement réel existe |
| Facture | ✅ « Facture (brouillon) S23T2… · 200,00 € » (RPC réelle) |
| Badge | ✅ « Badges » (Ajouté : vip) |
| Note interne | ✅ « Note interne » |
| Pièce jointe | ✅ agrégée sur message (pj=1) + entrée autonome « contrat-recette.pdf » |
| Acteur | ✅ « Wali Larabi » affiché (plus de NULL quand acteur présent) |
| Isolation multi-hôtels | ✅ 0 donnée d'un autre hôtel (RLS confirmée) |
| Ordre chronologique | ✅ desc |

**La RPC ne génère plus aucune erreur** et produit des événements **lisibles par
une réceptionniste**, toutes catégories confondues.

---

## Reste à faire (hors P0, en attente de validation)

- **P1** — Pagination keyset composite `(occurred_at, entry_id)` (timestamps
  identiques massifs confirmés en réel : nécessaire avant usage intensif).
- **P2** — Tests de charge (100/500/1000/5000) + EXPLAIN.
- **P3** — Durcissement `register_attachment` (préfixe chemin + appartenance).
- **Résiduel** — Corriger le bug de CTE non nommée dans `communication_timeline`
  (v1, non utilisée par le Journal) ; déployer `send-email`/`send-dispute-email`
  via `supabase functions deploy`.

**Statut P0 : corrections appliquées et validées en réel.** En attente de votre
validation de ce rapport avant de poursuivre (P1/P2/P3).
