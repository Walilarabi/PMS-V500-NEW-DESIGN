# P2 — Tests de charge du Journal Client 360° (mesures réelles)

> Mesures effectuées **sur la production** `flowtym-housekeeping` via la **vraie**
> `communication_timeline_v2` (impersonation d'un utilisateur réel). Volumes
> obtenus via un **client de test contrôlé** (jusqu'à 5000 événements),
> **intégralement nettoyé** après recette (vérifié : 0 restant). **Aucune
> estimation** : tous les chiffres ci-dessous sont mesurés (`EXPLAIN ANALYZE`,
> `clock_timestamp`, minimum de 3 itérations à chaud).

---

## P2.1 / P2.2 — Temps mesurés

### Première page (LIMIT 40) selon le volume — à chaud

| Volume (événements 1 client) | Temps 1ʳᵉ page |
|---|---|
| 100 | **4,2 ms** |
| 500 | **4,4 ms** |
| 1 000 | **5,0 ms** |
| 5 000 | **6,7 – 8,6 ms** |

> **Démarrage à froid** (tout premier appel d'une connexion) : **~158 ms**
> (compilation plpgsql + planification de l'union à 10 branches). Tous les appels
> suivants sont « à chaud » grâce au cache de plan → 4-9 ms.

### Toutes les métriques à 5 000 événements (min. de 3 essais)

| Opération | Temps |
|-----------|-------|
| Temps d'ouverture / 1ʳᵉ page | **6,7 ms** |
| Pagination (page médiane, curseur composite) | **5,4 ms** |
| Recherche texte (`ILIKE`) | **16,9 ms** ⬅ la plus lente |
| Filtrage (catégorie « note ») | **5,9 ms** |
| Changement de catégorie (catégorie vide) | **0,7 ms** |
| Filtre utilisateur (acteur) | **4,7 ms** |
| Affichage **fiche réservation** (scope réservation réelle, ~11 événements) | **4,4 ms** |
| Affichage **fiche client** (scope client, 5 000 événements) | **6,7 – 8,6 ms** |

**Toutes les opérations restent < 17 ms même à 5 000 événements** pour un seul
client — volume déjà extrême (un client réel dépasse rarement quelques centaines
d'événements ; le plus actif observé en prod ≈ 60).

---

## P2.3 — Analyse SQL (`EXPLAIN ANALYZE, BUFFERS`)

Requête interne (union des 10 sources, scope client 5 000 événements) :

- **Tri** : `Sort (top-N heapsort, Memory: 27 kB)` — traite 5 000 lignes et n'en
  garde que 40. **Très efficace** (2,4 ms). Pas de tri sur disque.
- **Union (`Append`)** : 5 000 lignes assemblées en **1,7 ms**.
- **Branches non concernées** (messages, logs, badges, incidents, audit/réservation,
  paiements, factures, prestations, pièces jointes) : **Index Scan / Nested Loop**,
  0 ligne, scans internes « never executed ». Parfaitement filtrées.
- **Branche notes** : `Seq Scan` (5 000 lignes, 1,0 ms) — **artefact de test**
  (la table ne contenait que ce client) ; en multi-tenant réel l'index
  `communication_internal_notes_guest_idx (guest_id, created_at)` est utilisé.
- **Planification : 4,6 ms** (10 branches) — **amortie par le cache de plan**
  plpgsql : payée une seule fois par connexion (= le coût à froid de ~158 ms),
  puis ~0 sur les appels suivants.
- **Buffers** : `shared hit=93` (tout en cache mémoire, 0 lecture disque).

`Execution Time` (requête dépouillée) : **2,67 ms** ; via la fonction complète
(colonnes + agrégats pièces jointes) : **6-9 ms** à chaud.

---

## P2.4 — Goulots d'étranglement (classés)

| Réf | Origine | Impact | Coût mesuré | Correction possible | Priorité |
|-----|---------|--------|-------------|---------------------|----------|
| **B1** | Démarrage à froid : compilation + planification de l'union à 10 branches au 1ᵉʳ appel de connexion | 1ʳᵉ ouverture après nouvelle connexion (pooling) | ~158 ms (une fois) puis ~0 | Table dénormalisée (moins de branches) ; pré-chauffage | **P1** |
| **B2** | Recherche texte `ILIKE '%...%'` appliquée **après** l'union (post-filtre, non indexable) | Recherche à très gros volume | 16,9 ms @5 000 (≈ linéaire) | Index trigram (`pg_trgm`) + recherche poussée dans les branches, ou table dénormalisée | **P2** |
| **B3** | Lecture de **tout** l'historique du client/réservation puis tri top-N (pas de LIMIT par branche) | Clients à très gros volume (10k+) | 8,6 ms @5 000 (≈ linéaire) | `ORDER BY + LIMIT` par branche avant union, ou table dénormalisée | **P2** |
| — | Branche notes en Seq Scan | Aucun (artefact de test ; index présent en réel) | — | — | Aucune |

**Aucun goulot P0** : à volumes réalistes (et même à 5 000), toutes les opérations
sont < 17 ms à chaud.

---

## P2.5 — Plan d'optimisation (rien implémenté)

| # | Optimisation | Gain estimé | Complexité | Risque de régression |
|---|--------------|-------------|------------|----------------------|
| O1 | **Table dénormalisée `timeline_events`** (alimentée par triggers sur toutes les sources) : lecture mono-table indexée | À froid 158 ms → ~5 ms ; recherche 17 ms → <2 ms ; passe à l'échelle (millions) | **Élevée** (triggers partout, backfill, synchro, double-écriture) | **Moyen-Élevé** |
| O2 | **`ORDER BY + LIMIT` par branche** avant l'union (curseur poussé dans chaque branche) | Réduit lecture+tri à très gros volume (lit ~40/branche au lieu de tout) | Moyenne | Moyen (exactitude du merge) |
| O3 | **Index trigram `pg_trgm`** sur `body`/`subject` + recherche poussée dans les branches | Recherche : 17 ms → <2 ms à gros volume | Moyenne | Faible |
| O4 | **Pré-chauffage du plan** (warm-up à l'ouverture de session) ou réduction du nombre de branches | À froid 158 ms → réduit | Moyenne | Moyen |
| O5 | Vérifier/garantir un index `(hotel_id|guest_id, ts)` sur **chaque** source | Marginal (déjà majoritairement en place) | Faible | Faible |

---

## Conclusion — capacité réelle du Journal 360°

- **À chaud, le Journal est rapide** : < 9 ms en pagination/ouverture jusqu'à
  **5 000 événements** pour un seul client (volume extrême), < 17 ms pour la
  recherche. Tri top-N efficace, branches indexées, 0 lecture disque.
- **Seul vrai coût** : le **démarrage à froid ~158 ms** (1ᵉʳ appel par connexion),
  amorti ensuite. Perceptible uniquement à la toute première ouverture après une
  nouvelle connexion BDD.
- **Aucune optimisation n'est requise** pour les volumes réels actuels et
  prévisibles. Les optimisations (O1-O4) ne deviennent pertinentes que si un
  client/réservation approche **10 000+ événements** ou si la latence de recherche
  devient critique.

**Recommandation** : **ne pas optimiser maintenant** (les gains ne justifient pas
le risque de régression à ce stade). Conserver ce rapport comme référence et
**passer à P3 (durcissement sécurité des pièces jointes)**, plus prioritaire pour
un composant aussi central. Revenir sur O1/O3 plus tard si le volume l'exige.

> Aucune optimisation appliquée. Données de test nettoyées. En attente de votre
> validation de ce rapport.
