# Journal Client 360° — Audit fonctionnel & QA (avant mise en production)

> **Aucune modification de code.** Rapport d'audit uniquement, en attente de
> validation avant toute correction.
>
> **Méthode & honnêteté** : cet environnement n'a **ni base de données déployée
> ni application en exécution**. L'audit est donc un **audit statique rigoureux**
> (traçage ligne à ligne du code et du SQL réellement livrés) — fiable pour la
> sécurité/RLS, la cohérence et l'UX. Pour la **performance**, je fournis une
> **analyse de complexité + un protocole de test chiffrable** ; je n'invente
> aucun chiffre « mesuré ». Les mesures réelles nécessitent un déploiement.

---

## PHASE 1 — Tests métier (vérification statique par traçage)

Pour chaque scénario : source attendue dans `communication_timeline_v2`
(`supabase/migrations/20260631_journal_360.sql`) → verdict.

| Scénario | Source / branche RPC | Apparaît ? | Verdict |
|----------|----------------------|:---:|---------|
| Création réservation | audit_logs `INSERT` (b6) | ✅ | OK |
| Modification réservation | audit_logs `UPDATE` (b6) | ✅ | OK |
| Changement de chambre | audit_logs UPDATE + diff `room_id` (b6) | ✅ | OK (dérivé) |
| Surclassement | — (non distinct du changement de chambre) | ⚠️ | PARTIEL (best-effort validé) |
| Délogement (walk) | — (aucun statut/marqueur) | ❌ | **MANQUANT** (best-effort validé) |
| Annulation | audit_logs `STATUS_CANCELLED` | ✅ | OK |
| No-show | audit_logs `STATUS_NO_SHOW` | ✅ | OK |
| Check-in | audit_logs `STATUS_CHECKED_IN` | ✅ | OK |
| Check-out | audit_logs `STATUS_CHECKED_OUT` | ✅ | OK |
| Paiement | payments (b7) | ✅ | OK |
| Remboursement | payments reversal/négatif (b7) | ✅ | OK |
| Facture | invoices (b8) | ✅ | OK |
| Ajout prestation | invoice_lines (b9) | ✅ | OK |
| Suppression prestation | invoice_lines `source='reversal'` (b9) | ✅ | OK |
| Ajout badge | guest_badge_history (b3) | ✅ | OK |
| Suppression badge | guest_badge_history diff (b3) | ✅ | OK |
| Ajout note interne | communication_internal_notes (b4) | ✅ | OK |
| Envoi email | conversation_messages (b1) ou communication_logs (b2) | ✅ | OK |
| Envoi WhatsApp | conversation_messages / logs | ✅ | OK |
| Pièce jointe | communication_attachments (b1 agg / b10 standalone) | ✅ | OK |

**Synthèse Phase 1** : **17/20 OK**, 2 partiels (surclassement, facture envoyée*),
1 manquant (délogement). *« Facture envoyée » n'est pas un événement distinct :
elle apparaît comme une communication si une facture est envoyée par email.

> ⚠️ **Réserve méthodologique** : « apparaît » signifie *le chemin de code produit
> l'entrée*. Une **passe de test manuelle sur environnement déployé** reste
> nécessaire (matrice fournie en annexe) pour confirmer le rendu réel.

---

## PHASE 2 — Cohérence des données (anomalies détectées)

| Réf | Gravité | Constat | Emplacement |
|-----|---------|---------|-------------|
| **A1** | **Moyenne** | **Pagination keyset incomplète** : curseur `occurred_at < p_before` **sans** composante `entry_id`. Les événements partageant un **timestamp identique** à la frontière de page (fréquent : check-in + paiement + email à la même seconde) peuvent être **sautés ou dupliqués**. | `20260631_…:359` (`WHERE … occurred_at < p_before`) vs `ORDER BY occurred_at DESC, entry_id DESC` |
| A4 | Faible | **Réservation supprimée** : `JOIN reservations` (INNER) → si la résa est hard-deletée, l'événement `DELETE` n'apparaît jamais. (La plupart des PMS annulent, pas suppriment → impact réel faible.) | b6 |
| A5 | Faible | **Filtre canal** masque implicitement les événements non-communication (`channel` NULL) — comportement défendable, à documenter pour l'utilisateur. | outer WHERE `channel = ANY` |
| A6 | Cosmétique | Montants finance non formatés (`120.00 EUR`), quantités `×2.000`. | b7/b8/b9 |
| — | OK | **Ordre chronologique** : `ORDER BY occurred_at DESC` ✅ | |
| — | OK | **Doublons** : anti-jointure logs↔messages ✅ ; OR scope (pas de double-comptage) ✅ ; pièces jointes liées non dupliquées en standalone ✅ | |
| — | OK | **Utilisateur affiché** : jointure `users.id` (comm/finance/CRM) et `users.auth_id` (audit_logs) — correcte ✅. Null → « Système » (actions service_role/night-audit). | |
| — | OK | **Date / Statut / Pièces jointes** affichés : oui (groupes par jour, heure, pastille statut, chips PJ). ✅ | |

**Événements manquants** : délogement (non tracé), surclassement (non distinct).
**Verdict Phase 2** : cohérence globalement bonne ; **une anomalie à corriger (A1)**.

---

## PHASE 3 — Performance (analyse de complexité — non mesurée ici)

> Aucune mesure empirique possible sans déploiement. Analyse statique + protocole.

**Chargement à la demande** ✅ : la timeline ne se monte qu'à l'ouverture
(section dépliée / onglet actif / drawer) — **aucun impact** sur les listes
(Flowday, Réservations, Planning). Confirmé dans le code (rendu conditionnel).

**Virtualisation** ✅ : `@tanstack/react-virtual` borne le DOM quel que soit le
volume affiché.

**Pagination** : `useInfiniteQuery` keyset, pages de 40.

**⚠️ Risque principal (A2, Moyen→Élevé selon volume)** : la RPC `communication_timeline_v2`
construit une CTE `unified` qui **UNION ALL 10 sources**, puis applique
`ORDER BY … LIMIT` dans le SELECT externe. Conséquences potentielles :
- Le prédicat keyset/filtre étant dans le SELECT externe, son **pushdown** dans
  chaque branche dépend du planner (la colonne `occurred_at` est souvent un
  `COALESCE(...)` **non indexé**) → risque de **scan de l'historique complet par
  page**, pas O(page).
- **Sous-requêtes corrélées** par ligne : agrégat des pièces jointes par message
  (b1/b2) et `EXCEPT`/`string_agg` par ligne de badge (b3) → coût croissant.

**Conclusion** : acceptable à faible/moyen volume ; **à valider impérativement
par un load-test** avant usage quotidien sur gros comptes.

**Protocole de test recommandé (à exécuter sur env. déployé)** :
1. Seeder un guest avec 100 / 500 / 1 000 / 5 000 événements (mix sources).
2. Mesurer (p50/p95) : 1ʳᵉ page (`communication_timeline_v2 … p_before=null`),
   page suivante (keyset), recherche (`p_search`), filtre catégorie, ouverture
   fiche client, ouverture fiche réservation.
3. `EXPLAIN (ANALYZE, BUFFERS)` sur la RPC pour vérifier le pushdown et les
   index utilisés.
4. Seuils cibles suggérés : 1ʳᵉ page < 300 ms p95 jusqu'à 5 000 événements.

**Si seuils non tenus** → voir optimisation P2 (table dénormalisée ou per-branch
keyset).

---

## PHASE 4 — Sécurité (audit statique RLS — fiable)

| Réf | Verdict | Détail |
|-----|---------|--------|
| **Isolation hôtel** | ✅ **Solide** | Chaque branche de la RPC filtre `x.hotel_id = public.get_user_hotel_id()`. `SECURITY DEFINER` + filtrage explicite → **aucune fuite cross-hôtel possible** via la RPC. |
| **RLS tables** | ✅ | `communication_attachments`, `communication_internal_notes`, `guest_incidents`, conversations, logs : policies SELECT `hotel_id = get_user_hotel_id()`. Écritures via RPC SECURITY DEFINER. |
| **Storage — accès PJ** | ✅ | Policies `storage.objects` (read/insert/delete) : `foldername(name)[1] = get_user_hotel_id()::text`. Upload vers un autre hôtel **bloqué** (WITH CHECK). Lecture d'un objet d'un autre hôtel **bloquée** (SELECT). |
| **URL signées** | ✅ (par conception) | `createSignedUrl` respecte la RLS storage à la génération. ⚠️ Une URL signée reste accessible (lien public) pendant son TTL (1 h) — **normal**, mais à ne pas journaliser/partager. |
| **Multi-hôtels** | ✅ | Un hôtel ne peut consulter ni les événements, ni les conversations, ni les pièces jointes d'un autre. Vérifié sur les 10 branches. |
| **S2** | ⚠️ **Durcissement recommandé (Moyen)** | `register_attachment` **ne valide pas** que `p_storage_path` commence par `hotel_id`, ni que `p_guest_id`/`p_reservation_id`/`p_message_id` appartiennent à l'hôtel. **Pas de fuite en lecture** (RLS storage+table bloquent), mais un client malveillant pourrait créer des **métadonnées incohérentes** (chemin/guest étranger, inexploitables). Reco : valider le préfixe `hotel_id/` + appartenance. |
| **S4** | ℹ️ Info | `audit_logs.actor_user_id = auth.uid()` ; jointure sur `users.auth_id` correcte ; actions sans session (night-audit, service_role) → acteur « Système ». |

**Verdict Phase 4** : **isolation multi-hôtels validée** par traçage. Un seul point
de durcissement (S2, intégrité, non bloquant). **Recommandation** : confirmer par
un test live « utilisateur hôtel A tente de lire une PJ/timeline de l'hôtel B ».

---

## PHASE 5 — UX (analyse du rendu statique)

| Réf | Gravité | Constat |
|-----|---------|---------|
| **U1** | **Moyenne** | **Pas de dark mode** dans le composant (0 classe `dark:`), alors que ~18 composants de l'app en utilisent. Incohérence si le dark mode est actif. (Cohérent toutefois avec `ClientProfile360`/`FinancialTimelinePanel`, eux aussi light-only.) |
| U4 | Faible | **Bouton « Exporter » absent** (présent dans la maquette L3) — pas de export PDF/CSV de la timeline. |
| U5 | Faible | **Note interne** : pas d'édition/suppression depuis l'UI (création seule). |
| U6 | Faible | Corps des messages `line-clamp-4` **sans « voir plus »** → texte long tronqué sans dépliage. |
| U3 | Faible | Accessibilité : boutons icône (rafraîchir, fichier) **sans `aria-label`**. |
| U2 | Info | Densité correcte ; sur drawer 500px les filtres avancés tiennent (flex-wrap) ; sur mobile le drawer passe en `w-full`. À tester sur petit écran. |
| — | ✅ | **Lisibilité / cohérence graphique** : groupes par jour, pastilles colorées par catégorie, icônes canal, heure monospace, statut, acteur — clair et cohérent avec le design system (violet, slate). **Temps de compréhension** : faible (codes couleur + libellés explicites). |

**Verdict Phase 5** : visuellement propre et lisible ; principaux manques =
**dark mode (U1)** et **export (U4)**.

---

## PHASE 6 — Livrable

### 1. Ce qui fonctionne parfaitement
- Agrégation **17/20 scénarios** métier (communication, CRM, réservation, finance, notes, PJ).
- **Isolation multi-hôtels** (RLS + Storage) — robuste.
- **Chargement à la demande** (zéro impact sur les listes) + **virtualisation**.
- **Ordre chronologique**, anti-doublons, acteur/date/statut/PJ affichés.
- **Source unique** fiche client/réservation (Phase 6 UUID) + repli Planning sans faux rattachement.
- v1 conservée → **aucune régression L3** ; 70 tests verts, 0 erreur de type réelle.

### 2. Anomalies détectées
- **A1 (Moyen)** pagination keyset non composite → saut/doublon possible à timestamps égaux.
- **A2 (Moyen→Élevé)** perf : CTE full-history + sous-requêtes corrélées (non mesuré).
- **A3** événements partiels/manquants : délogement (manquant), surclassement (non distinct), facture envoyée (dérivée).
- **A4** « réservation supprimée » invisible après hard-delete.
- **A5/A6** filtre canal masquant + formatage montants.
- **S2** `register_attachment` sans validation de préfixe/appartenance (intégrité).
- **U1/U4/U5/U6** dark mode, export, édition note, « voir plus ».

### 3. Régressions potentielles
- **R3** : `@tanstack/react-virtual` **doit être installé au build** (présent dans `package.json`) — vérifier la CI.
- **R4** : la migration référence des tables legacy (`audit_logs`, `payments`, `invoices`) → un rebuild *from scratch* depuis le seul dossier racine échouerait (ordre d'application à documenter).
- **R5** : `INSERT storage.buckets` + policies `storage.objects` nécessitent les privilèges admin (OK via `supabase db push`).
- Sinon : modifications **additives** (Phase 6, v2) → risque de régression faible (tests verts).

### 4. Risques
- **Déploiement non effectué** : migration `20260631` + bucket Storage + redeploy edge functions **non appliqués** → **le Journal n'est pas live**. Risque n°1 pour « demain matin ».
- **Performance** non validée empiriquement (A2) sur gros comptes.
- **Pagination** (A1) : perte de confiance utilisateur si un événement « disparaît » ponctuellement.

### 5. Optimisations recommandées (priorisées)
- **P1 (haute)** — Curseur **composite** `(occurred_at, entry_id)` → corrige A1.
- **P2 (haute)** — Stratégie perf : per-branch `ORDER+LIMIT` avant union **ou** table dénormalisée `timeline_events` alimentée par triggers (lecture O(page)) **ou** index sur expressions. À décider après load-test.
- **P3 (moyenne)** — Durcir `register_attachment` (préfixe `hotel_id/` + appartenance) → corrige S2.
- **P4 (moyenne)** — Dark mode + bouton Export (U1/U4).
- **P5 (basse)** — Formatage montants/quantités, « voir plus », `aria-label`, édition/suppression note.
- **P6 (optionnelle)** — Événements explicites délogement/surclassement (au-delà du best-effort).

### 6. Corrections prioritaires (ordre pour « production demain »)
1. **Déployer** : `20260631_journal_360.sql` + bucket + redeploy `send-email`/`send-whatsapp` (sinon non fonctionnel). 
2. **P1** : curseur composite (correction correcte, peu risquée).
3. **Load-test (P2)** + décision stratégie perf.
4. **P3** : durcissement `register_attachment`.
5. **Test live sécurité** cross-hôtel + matrice de tests métier (annexe).

### 7. Niveau de maturité du Journal 360°
- **Architecture & fonctionnel** : solide (au-delà d'un MVP).
- **Prêt pour la réception, demain matin** : **PAS ENCORE**. Bloquants : déploiement
  non fait, perf non testée, pagination (A1), dark mode (U1).
- **Note de maturité : ~7/10 (bêta avancée).** Devient « production-ready » après
  **P1 + P3 + load-test (P2) + déploiement** et la passe de tests live.

---

## Annexe — Matrice de tests live à exécuter (réception)
Pour chaque scénario Phase 1 : déclencher l'action réelle dans le PMS → ouvrir le
Journal (fiche client, fiche réservation, Flowday) → vérifier : présence de
l'entrée, **bon horodatage**, **bon acteur**, **bon statut**, **bonne catégorie**,
PJ cliquable (URL signée), ordre chronologique, filtres (catégorie/canal/période/
utilisateur/recherche), pagination (scroll > 40 entrées), et **test d'isolation**
(connecté à l'hôtel A, aucune donnée de l'hôtel B visible).
