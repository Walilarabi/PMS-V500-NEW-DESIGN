# Journal Client 360° — Rapport de RECETTE réelle (production)

> Recette exécutée **sur la base de production déployée** `flowtym-housekeeping`
> (`hzrzkvdebaadditvbqis`), via SQL/RPC réels (impersonation d'un vrai
> utilisateur). **Pas de captures UI** (aucun navigateur/app en exécution dans
> l'environnement — méthode validée avec vous). Toutes les données de test
> insérées ont été **supprimées** en fin de recette (vérifié : compteurs à 0).

---

## 1. Déploiement effectué (étapes 1-3)

| Étape | Action | Résultat |
|-------|--------|----------|
| 1 | Migrations **L1→L3.1** appliquées dans l'ordre : `20260627` (comm+badges), `20260628` (cohérence badges↔flags + backfill), `20260629` (conversations), `20260630` (timeline v1), `20260631` (journal 360 + attachments) | ✅ 5/5 succès |
| 2 | Bucket Storage privé `communication-attachments` + 3 policies `storage.objects` hôtel-scopées | ✅ créé |
| — | Vérif post-déploiement | ✅ 10 tables, 9 RPC, 3 enums, bucket + policies présents |
| 3 | Edge Functions | ✅ `send-whatsapp` déployée (ACTIVE v1) — ⚠️ `send-email` (411 l.) & `send-dispute-email` : **à déployer via `supabase functions deploy`** (refus de transcription manuelle de code MIME/base64 critique). N'impacte pas la recette du Journal. |

> Découverte au déploiement : **toute la plateforme Communication était absente
> de la prod** (seul `guest_incidents` préexistait, au bon schéma). Les 5
> migrations ont donc tout créé.

---

## 2. Résultats de recette par scénario

Cible réelle : hôtel `02b9eb0e…` (le plus riche : 355 réservations, 1253
événements d'audit), client `015f4b34…`, réservation `caea79fa…` (RES réelle
avec 10 événements d'audit). Utilisateur impersonné : **Wali Larabi**.

| Scénario | Apparaît dans la timeline ? | Rendu | Verdict |
|----------|:---:|-------|---------|
| Envoi email | ✅ | « RECETTE — Confirmation », acteur OK, **PJ agrégée (1)** | **OK** |
| Envoi WhatsApp | ✅ | « RECETTE — WhatsApp… », acteur OK | **OK** |
| Note interne | ✅ | « note interne réception », acteur OK | **OK** |
| Ajout badge | ✅ | « Badges: +vip », acteur OK | **OK** |
| Pièce jointe (sur message) | ✅ | comptée sur le message (`attach=1`) | **OK** |
| Pièce jointe (autonome) | ✅ | entrée `attachment` « contrat-recette.pdf » | **OK** |
| Incident | ✅ | « Incident: … », acteur OK | **OK** |
| Facture | ✅ | « Facture émise 300 € » (branche corrigée) | **OK*** |
| Paiement / Remboursement | ⚠️ | branche structurellement valide (`payments.created_by` existe) — non affichée (aucun paiement lié à la résa test) | **À confirmer** |
| Ajout / Suppression prestation | ⚠️ | branche valide (`invoice_lines.created_by` existe) — non affichée | **À confirmer** |
| Création réservation | ⚠️ | **apparaît mais libellé « Événement réservation »** (action réelle `created`) | **DÉFAUT** |
| Modification réservation | ⚠️ | idem générique (action `updated`) | **DÉFAUT** |
| Changement de chambre | ❌ | non dérivé (payload `diff`, pas `before/after`) | **DÉFAUT** |
| Check-out | ⚠️ | apparaît en générique (action `CHECKOUT`) | **DÉFAUT** |
| Check-in / Annulation / No-show | ❌ | **non présents** dans `audit_logs` (vocabulaire réel : created/updated/deleted/CHECKOUT) | **MANQUANT** |

`*` la branche `invoices` du RPC déployé **plante** (voir §3, showstopper) ;
le rendu « Facture émise » a été validé avec le correctif d'une ligne appliqué
en lecture seule.

**Bon point majeur** : toutes les catégories (communication, CRM, note,
incident, finance, attachment, réservation) s'agrègent bien dans **une seule
timeline chronologique** ; communication / CRM / notes / pièces jointes sont
**parfaits** sur données réelles.

---

## 3. Anomalies critiques découvertes (schéma repo ≠ schéma prod)

La recette a révélé que plusieurs migrations « legacy » du **dépôt** ne
correspondent **pas** au schéma réellement **déployé**. Mes RPC, écrites d'après
le dépôt, divergent donc du réel :

| # | Gravité | Anomalie | Détail / preuve | Correctif |
|---|---------|----------|-----------------|-----------|
| **C1** | 🔴 **SHOWSTOPPER** | `invoices.created_by` **n'existe pas** en prod → `communication_timeline_v2` lève `ERROR 42703` et **échoue entièrement** (toute la timeline KO). | Colonnes réelles `invoices` : …, `created_at`, `issued_at`, `guest_id`, `reservation_id` (pas de `created_by`). | Branche `invoices` : `created_by` → `NULL::uuid`, retirer la jointure `users`. |
| **C2** | 🟠 Élevée | **Libellés réservation faux** : le trigger d'audit déployé émet `created`/`updated`/`deleted`/`CHECKOUT`/`CHECKOUT_HK_CREATED`, **pas** `INSERT`/`STATUS_*`. Tous les événements tombent en « Événement réservation ». | `select action,count(*) from audit_logs where entity='reservation'` → updated 903, created 373, deleted 10, CHECKOUT 3, CHECKOUT_HK_CREATED 3, INSERT 1. | Remapper le `CASE` sur le vrai vocabulaire (created→créée, updated→modifiée, CHECKOUT→check-out, deleted→supprimée). |
| **C3** | 🟠 Élevée | **Payload différent** : `updated` → clé `diff` (pas `before`/`after`) ; `created` → `after`. Ma dérivation changement de chambre / modif tarifaire ne matche jamais. | `payload_keys` : created=[after], updated=[diff], CHECKOUT=[checked_out_at,previous_status,…]. | Lire `payload->'diff'` pour détecter room/tarif. |
| **C4** | 🟠 Élevée | **Acteur réservation = NULL** : `audit_logs.actor_user_id` ne correspond pas à `users.auth_id` (ma jointure échoue → acteur vide). Il contient vraisemblablement `users.id`. | Tous les événements réservation affichent acteur `null`. | Jointure sur `users.id` (ou `COALESCE` id/auth_id). |
| **C5** | 🟡 Moyenne | **Check-in / Annulation / No-show absents de l'audit** : non distingués dans `audit_logs` (le PMS ne les journalise pas sous une action dédiée). | Vocabulaire réel sans STATUS_*. | Dériver depuis `payload->'diff'->'status'` sur `updated`, ou ajouter un audit dédié (hors L3.1). |
| **A1** | 🟡 Moyenne | **Pagination keyset confirmée défaillante en réel** : très nombreux événements au **même timestamp** (ex. `created`+`updated`+`CHECKOUT` à `12:45:42` ; plusieurs `updated` à `14:24`, `14:26`). Le curseur `occurred_at < p_before` (sans `entry_id`) **sautera/dupliquera** des entrées en frontière de page. | Visible dans la timeline (multiples lignes même minute/seconde). | Curseur composite `(occurred_at, entry_id)` (= P1). |

**Informations** :
- `get_user_hotel_id()` résout l'**hôtel actif/membership** (ici `02b9eb0e`),
  pas `users.hotel_id` — comportement normal, à connaître.
- `guest_incidents` préexistait au schéma exact attendu → no-op (✅).

---

## 4. Sécurité — isolation multi-hôtels (✅ VALIDÉE en réel)

Test impersonné (rôle `authenticated`, claim du user de `02b9eb0e`) :

| Mesure | Résultat |
|--------|----------|
| communication_logs visibles | 1 (uniquement l'hôtel courant) |
| logs d'**autres hôtels** visibles | **0** ✅ |
| threads / notes / pièces jointes / incidents d'autres hôtels | **0 / 0 / 0 / 0** ✅ |

→ **Un hôtel ne voit aucune donnée d'un autre hôtel.** RLS confirmée sur la base
réelle. (Storage : policies `foldername[1]=hotel_id` également en place.)

---

## 5. Ce qui fonctionne / ce qui bloque

**Fonctionne parfaitement (données réelles)** : agrégation chronologique
unique ; email, WhatsApp, notes internes, badges, incidents, **pièces jointes**
(agrégées sur message + autonomes) ; isolation RLS multi-hôtels ; déploiement BDD.

**Bloquant avant usage réception** :
- 🔴 **C1** (RPC v2 plante) — la timeline est **inutilisable** tant que non corrigée.
- 🟠 **C2/C3/C4** — événements PMS présents mais **mal libellés et sans acteur**.
- 🟡 **A1** — pagination à corriger.

---

## 6. Plan de correction recommandé (révisé après recette)

> Le séquencement initial (P1/P2/P3) doit être précédé d'un lot **P0** révélé par
> la recette.

1. **P0 (nouveau, prioritaire)** — Corriger `communication_timeline_v2` contre le
   schéma réel : C1 (`invoices.created_by`→NULL), C2 (mapping actions réelles),
   C3 (payload `diff`), C4 (acteur via `users.id`). **Indispensable** pour que le
   Journal fonctionne. Mettre à jour le fichier repo `20260631` en cohérence.
2. **P1** — Curseur de pagination composite `(occurred_at, entry_id)` (A1).
3. **P2** — Tests de charge (100/500/1000/5000) + EXPLAIN.
4. **P3** — Durcissement `register_attachment` (préfixe chemin + appartenance).
5. **Compléments** — Déployer `send-email`/`send-dispute-email` via
   `supabase functions deploy` ; aligner le fichier repo `0080_billing`/`0030`
   sur le schéma réel (dette de cohérence repo↔prod).

---

## 7. Niveau de maturité (post-recette)

- **Déploiement** : ✅ réalisé (BDD + bucket + 1 edge function).
- **Sécurité/isolation** : ✅ validée en réel.
- **Communication / CRM / notes / pièces jointes** : ✅ opérationnels.
- **Événements PMS / finance** : ❌ **non fonctionnels en l'état** (C1 showstopper + C2/C3/C4).
- **Verdict** : **NON livrable à la réception tant que P0 n'est pas corrigé.**
  Maturité repassée à **~5/10** (la recette a déclassé l'estimation 7/10 : le
  cœur "événements PMS" ne marche pas contre le schéma réel). Après P0+P1 et
  re-recette : cible 8/10.

> **Aucune correction appliquée** : conformément à votre séquencement (« après
> validation de cette recette : P1/P2/P3 »). J'attends votre validation de ce
> rapport pour lancer **P0 (correctif RPC)** puis P1/P2/P3.
