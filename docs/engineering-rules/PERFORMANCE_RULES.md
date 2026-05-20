# PERFORMANCE_RULES.md — Politique de Performance Extrême et Zéro Latence

# OBJECTIF

Le SaaS doit donner une impression de vitesse immédiate.

Chaque interaction utilisateur doit sembler :
- instantanée,
- fluide,
- réactive,
- sans attente perceptible,
- sans blocage visuel,
- sans “moulinage”.

L’utilisateur clique → le système répond immédiatement.

Le logiciel doit donner une sensation :
- premium,
- ultra optimisée,
- professionnelle,
- moderne,
- nerveuse,
- rapide même sous forte charge.

La performance est une fonctionnalité critique.
Un logiciel lent est considéré comme cassé.

---

# RÈGLE ABSOLUE

TOUTE fonctionnalité doit être développée avec :
1. performance frontend,
2. performance backend,
3. performance base de données,
4. performance réseau,
5. performance rendu UI,
6. performance API,
7. performance temps réel,
8. optimisation mémoire,
9. optimisation cache,
10. optimisation requêtes.

avant même d’ajouter des fonctionnalités secondaires.

---

# OBJECTIFS DE PERFORMANCE

## Temps de réponse cible

Le système doit viser :

- Interaction UI : < 50ms
- Transition écran : < 100ms
- Réponse API standard : < 200ms
- Recherche : < 300ms
- Chargement page : < 1 seconde
- Actions critiques : quasi instantanées

Objectif :
Aucune sensation de lenteur.

---

# 1. FRONTEND ULTRA RÉACTIF

Le frontend doit être :
- instantané,
- optimiste,
- non bloquant,
- fluide.

Obligatoire :
- optimistic UI,
- skeleton loaders,
- lazy loading,
- code splitting,
- memoization,
- virtualisation des listes,
- cache intelligent,
- prefetch intelligent,
- debounce,
- throttling,
- rendering minimal.

Interdiction :
- rerender inutiles,
- fetchs doublons,
- composants géants,
- appels API inutiles,
- état global mal géré.

---

# 2. AUCUN “MOULINAGE” INUTILE

Quand un utilisateur clique :
- le feedback visuel doit être immédiat,
- l’interface doit réagir instantanément,
- les données doivent apparaître rapidement.

Toujours :
- afficher un état optimiste,
- éviter les loaders plein écran,
- éviter les blocages UI,
- garder l’interface interactive.

Le logiciel ne doit jamais sembler “figé”.

---

# 3. OPTIMISATION DES APIS

Chaque API doit être :
- rapide,
- minimaliste,
- paginée,
- compressée,
- optimisée.

Obligatoire :
- index SQL,
- requêtes optimisées,
- pagination,
- cache,
- limitation payload JSON,
- éviter overfetching,
- éviter N+1 queries.

Interdiction :
- SELECT *,
- requêtes inutiles,
- boucles DB,
- requêtes synchrones lentes,
- appels API en cascade.

---

# 4. STRATÉGIE CACHE OBLIGATOIRE

Utiliser agressivement :
- cache mémoire,
- Redis,
- cache frontend,
- cache API,
- cache requêtes,
- cache CDN.

Le système doit éviter de recalculer inutilement.

Toujours :
- invalider intelligemment,
- précharger les données probables,
- mémoriser les résultats fréquents.

---

# 5. BASE DE DONNÉES ULTRA OPTIMISÉE

Obligatoire :
- indexation correcte,
- requêtes profilées,
- relations optimisées,
- colonnes utiles uniquement,
- pagination,
- limitation JOIN complexes.

Interdiction :
- requêtes lourdes répétées,
- scans complets inutiles,
- relations non indexées.

Chaque requête doit être pensée pour :
- faible latence,
- faible charge CPU,
- faible consommation mémoire.

---

# 6. TEMPS RÉEL

Les mises à jour temps réel doivent être :
- instantanées,
- fiables,
- légères.

Utiliser :
- WebSockets,
- SSE,
- subscriptions optimisées.

Interdiction :
- polling agressif,
- refresh complets inutiles.

---

# 7. CHARGEMENT INTELLIGENT

Ne jamais charger :
- ce qui n’est pas visible,
- ce qui n’est pas utilisé,
- ce qui n’est pas nécessaire immédiatement.

Utiliser :
- lazy loading,
- infinite scroll,
- streaming,
- partial rendering,
- suspense,
- route splitting.

---

# 8. PERFORMANCE MOBILE

Le SaaS doit être :
- fluide sur mobile,
- fluide sur connexions lentes,
- fluide sur machines moyennes.

Optimiser :
- poids JS,
- images,
- fonts,
- animations,
- requêtes réseau.

Interdiction :
- bundles énormes,
- animations lourdes,
- images non compressées.

---

# 9. ANIMATIONS

Les animations doivent :
- être fluides,
- être légères,
- utiliser GPU acceleration.

Interdiction :
- animations bloquantes,
- animations inutiles,
- effets lourds.

Préférer :
- transform,
- opacity,
- transitions optimisées.

---

# 10. CONCURRENCE ET SCALABILITÉ

Le système doit supporter :
- forte montée en charge,
- multiples utilisateurs simultanés,
- pics de trafic.

Prévoir :
- architecture scalable,
- queues,
- workers,
- tâches async,
- horizontal scaling.

Interdiction :
- traitements bloquants,
- tâches longues dans requêtes HTTP,
- logique lourde dans frontend.

---

# 11. SURVEILLANCE PERFORMANCE

Mesurer systématiquement :
- temps API,
- temps DB,
- temps rendu,
- memory leaks,
- CPU usage,
- temps de chargement,
- Core Web Vitals.

Obligatoire :
- profiling,
- monitoring,
- alertes performance.

---

# 12. UX DE VITESSE

Même lorsqu’une opération prend du temps :
- donner un feedback immédiat,
- afficher progression,
- rendre l’interface utilisable.

L’utilisateur ne doit jamais se demander :
- “est-ce bloqué ?”
- “ça charge encore ?”

---

# 13. RÈGLES DE DÉVELOPPEMENT

Avant chaque feature :
1. Identifier les goulots d’étranglement.
2. Réduire les requêtes.
3. Minimiser les rerenders.
4. Optimiser la DB.
5. Optimiser le réseau.
6. Réduire le JavaScript.
7. Réduire les calculs inutiles.
8. Vérifier la fluidité mobile.
9. Tester sous charge.
10. Mesurer les performances réelles.

---

# 14. INTERDICTIONS ABSOLUES

Interdit :
- spinner partout,
- requêtes inutiles,
- fetch en boucle,
- rerender massifs,
- composants lourds,
- pages lentes,
- hydration lente,
- gros bundles JS,
- images non optimisées,
- requêtes DB mal indexées,
- calculs bloquants frontend,
- appels synchrones lourds.

---

# 15. MENTALITÉ OBLIGATOIRE

Le code doit être pensé comme si :
- chaque milliseconde comptait,
- chaque requête coûtait cher,
- chaque rerender était suspect,
- chaque attente utilisateur était dangereuse.

Tu dois penser :
- optimisation,
- vitesse,
- fluidité,
- réactivité,
- scalabilité,
- efficacité.

---

# STACK PERFORMANCE RECOMMANDÉE

Frontend :
- Next.js App Router
- React Server Components
- TanStack Query
- Zustand
- Virtualized lists
- Dynamic imports

Backend :
- Fastify
- NestJS
- Redis
- Queue system
- WebSockets

DB :
- PostgreSQL optimisé
- Prisma optimisé
- Indexation avancée

Infra :
- CDN
- Edge caching
- Cloudflare
- Load balancing

---

# CHECKLIST AVANT VALIDATION

Avant de considérer une feature terminée :

- Temps API mesuré
- Requêtes DB profilées
- Index vérifiés
- Bundle analysé
- Rerenders vérifiés
- Mobile testé
- Cache testé
- Temps réel testé
- Montée en charge testée
- UX fluide validée
- Aucun moulinage inutile
- Feedback instantané présent

---

# RÈGLE FINALE

Le SaaS doit donner la sensation :
- qu’il anticipe les actions,
- qu’il répond instantanément,
- qu’il est plus rapide que la concurrence.

La rapidité perçue est aussi importante que la rapidité réelle.

Chaque clic doit sembler immédiat.