# L3 — Journal Unifié des Communications (dossier de conception)

> **Statut** : conception → **EN ATTENTE DE VALIDATION**. Aucune ligne de code
> applicatif ne sera écrite avant votre feu vert.
> **Contraintes** : ne pas supprimer `communication_logs` · réutiliser le socle
> Conversations (L2) · préparer l'inbound futur · **données réelles uniquement**,
> aucun mock, aucun `localStorage` métier.

---

## 0. Principe directeur

Une **timeline unique, chronologique stricte**, alimentée par un **agrégateur
serveur** (RPC `SECURITY DEFINER`, hôtel-scopé) qui fusionne **4 sources réelles**
en une seule liste normalisée. Un seul composant React réutilisable est affiché
à 3 emplacements (fiche client, fiche réservation, Flowday).

### Sources fusionnées (toutes réelles, déjà en base)

| # | Source | Type d'entrée | Remarque |
|---|--------|---------------|----------|
| 1 | `conversation_messages` (L2) | message email/sms/whatsapp/internal, in/out | **primaire** ; porte déjà `delivered_at`/`read_at` pour l'inbound futur |
| 2 | `communication_logs` **anti-jointe** (`WHERE id NOT IN (SELECT communication_log_id FROM conversation_messages)`) | message historique | fait apparaître **l'historique** sans backfill destructif ni double comptage |
| 3 | `guest_badge_history` | action CRM (badge VIP/blacklist ajouté/retiré) | « 09:40 Badge VIP ajouté » |
| 4 | `communication_internal_notes` *(nouvelle table L3)* | note interne | « 09:45 Note interne réception » — créable depuis la timeline |

> Les événements « Email ouvert » / « Réponse client reçue » de votre exemple
> dépendent des **webhooks entrants (L7)**. Le schéma les accueille déjà
> (`direction='inbound'`, statut `delivered`/`read`) : ils apparaîtront
> automatiquement dans la timeline dès L7, **sans rework**.

---

## 1. Maquette de la timeline

Composant `CommunicationTimeline` (réutilise le style éprouvé de
`FinancialTimelinePanel`). Filtres en tête, fil vertical, composeur de note en bas.

```
┌────────────────────────────────────────────────────────────────┐
│  Journal des communications                      [⟳]  [Exporter]│
│  ┌──────────┬──────────┬───────────┬─────────────┐              │
│  │ Tous ▾   │ Canal ▾  │ Statut ▾  │ 🔍 Rechercher│              │
│  └──────────┴──────────┴───────────┴─────────────┘              │
├────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ── lundi 2 juin 2026 ─────────────────────────────────         │
│                                                                  │
│  ● 09:12  ✉️ Email · Envoyé              👤 M. Durand (réception)│
│  │         Confirmation de réservation                           │
│  │         « Bonjour M. Martin, nous confirmons… »      📎 1     │
│  │                                                                │
│  ● 09:15  ✉️ Email · Ouvert  (L7)        — système               │
│  │                                                                │
│  ● 09:20  ✉️ Email · Reçu  (inbound, L7) 👤 Client               │
│  │         « Merci, à quelle heure le check-in ? »                │
│  │                                                                │
│  ● 09:25  💬 WhatsApp · Livré            👤 M. Durand            │
│  │         « Check-in à partir de 15h 🙂 »                        │
│  │                                                                │
│  ● 09:40  🏷️ Badge · VIP ajouté          👤 Mme Leroy            │
│  │                                                                │
│  ● 09:45  📝 Note interne                 👤 Réception            │
│  │         « Client allergique aux arachides — prévenir resto »   │
│                                                                  │
│  ──────────────────────────────────────────────────────         │
│  ┌──────────────────────────────────────────────┐  [+ Note]     │
│  │ Ajouter une note interne…                     │              │
│  └──────────────────────────────────────────────┘              │
└────────────────────────────────────────────────────────────────┘
```

**Chaque entrée affiche** (exigences respectées) :
- **Date + Heure** : groupement par jour + heure `HH:mm` par entrée.
- **Canal** : icône + libellé (✉️ Email, 💬 WhatsApp, 📱 SMS, 📝 Note, 🏷️ CRM).
- **Statut** : pastille colorée (queued/sent/delivered/read/failed ; ou « ajouté/retiré » pour CRM).
- **Utilisateur** : nom de l'agent (`created_by`/`changed_by` → jointure `users`) ou « Client » (inbound) / « système ».
- **Contenu** : objet + aperçu du corps (markdown/texte tronqué, dépliable).
- **Pièces jointes si présentes** : `metadata.attachments[]` (compteur 📎 + liste au survol/clic). Aucune aujourd'hui → rien affiché ; prêt pour l'inbound et l'email entrant.

---

## 2. Emplacement — Fiche Client (`ClientProfile360.tsx`, drawer 480px)

Nouvelle **section dédiée** insérée entre **Saisonnalité** (l.268) et
**Identité & coordonnées** (l.271) :

```
Header VIP · KPIs · Séjours · Saisonnalité
┌─────────────────────────────────────────┐
│ 💬 Journal des communications     [déplier]│   ← NOUVEAU
│   (timeline scopée guest_id, 5 dernières, │
│    bouton « Voir tout » → vue étendue)    │
└─────────────────────────────────────────┘
Identité & coordonnées · Historique réservations
```

- **Scope** : `guestId` (toutes réservations confondues).
- **Lazy** : la section ne charge ses données **qu'au dépliage** (pas au montage du drawer).
- Affichage **compact** (5 entrées + « Voir tout »).

---

## 3. Emplacement — Fiche Réservation (`ReservationDetailsModal.tsx`, modal 7 onglets)

Nouvel **8ᵉ onglet** `communications` (« Journal »), après *Fidélité* :

```
[Réservation][Facturation][Cardex][Incidents][Objets oubliés][Avis][Fidélité][💬 Journal]
                                                                              └─ NOUVEAU
```

- Onglet ajouté à la liste (≈ l.3104) + rendu conditionnel `activeTab === 'communications'` (≈ l.3120) → `<TabCommunications reservation={…} />`.
- **Scope** : `reservationId` ET `guestId` (la RPC accepte les deux ; une réservation montre les échanges liés à la résa **et** au client).
- **Lazy** : données chargées seulement quand l'onglet est ouvert (les onglets ne montent pas tant qu'inactifs).

---

## 4. Emplacement — Flowday (`OperationsTable.tsx`, menu ⋮)

Nouvelle **4ᵉ action** dans le menu ⋮ (après *Changement de chambre*,
*Communication client*, *Gérer les badges*) :

```
⋮
├ 🔁 Changement de chambre
├ ✉️ Communiquer (Email / WhatsApp)
├ 🏷️ Gérer les badges
└ 🕑 Journal des communications     ← NOUVEAU
        └─ ouvre un Drawer droit (réutilise CommunicationTimeline,
           scope reservationUuid + guestId de la ligne)
```

- Réutilise le **pattern Drawer** de `ClientProfile360`.
- La ligne Flowday porte déjà `row.guestId` et `row.reservationUuid` → scope direct.
- **Aucun impact** sur le rendu du tableau du jour : la timeline n'est chargée **qu'à l'ouverture** du drawer (jamais pour toutes les lignes).

---

## 5. Impact performances

| Levier | Décision |
|--------|----------|
| **Agrégation** | 1 RPC `communication_timeline(p_guest_id, p_reservation_id, p_limit, p_before)` = 4 `SELECT` indexés + `UNION ALL` + `ORDER BY occurred_at DESC LIMIT n`. Jeux de résultats **bornés par client/réservation** (petits). |
| **Index** | Déjà présents : `conversation_messages_guest_idx`/`_reservation_idx`, `communication_logs_guest_idx`/`_reservation_idx`, `guest_badge_history_guest_idx`. **À ajouter** : index sur `communication_internal_notes (guest_id, created_at)` / `(reservation_id, created_at)`. |
| **Pagination** | Keyset par `occurred_at` (`p_before`) → « Voir plus » sans OFFSET coûteux. Page = 30 entrées. |
| **Chargement** | **Strictement à la demande** : section dépliée (fiche client), onglet ouvert (réservation), drawer ouvert (Flowday). **Jamais** au montage des écrans ni en masse sur la liste Flowday. |
| **Cache** | React Query, clé `['comm-timeline', guestId, reservationId]`, `staleTime` court ; invalidation après envoi (Email/WhatsApp) ou ajout de note. |
| **Charge réseau** | 1 appel RPC par ouverture ; pas de N+1 (la jointure `users` pour le nom d'agent est faite **côté SQL**). |

**Conclusion** : coût négligeable et localisé ; aucune régression sur Flowday
(le tableau du jour n'embarque pas la timeline).

---

## 6. Plan d'implémentation

**Étape A — Base (migration `20260630_communication_timeline.sql`, additive)**
1. Table `communication_internal_notes` (id, hotel_id, guest_id, reservation_id, author_user_id, body, created_at) + RLS hôtel + index.
2. RPC `communication_timeline(p_guest_id, p_reservation_id, p_limit, p_before)` `SECURITY DEFINER` hôtel-scopé → renvoie la liste normalisée (UNION ALL des 4 sources, jointure `users` pour le nom d'agent, anti-jointure logs↔messages).
3. RPC `add_internal_note(p_guest_id, p_reservation_id, p_body)` `SECURITY DEFINER`.
4. Fichier rollback hors `migrations/`.

**Étape B — Service & hook frontend**
5. `timeline.service.ts` : `fetchCommunicationTimeline(params)` + `addInternalNote(params)` (types normalisés `TimelineEntry`).
6. `useCommunicationTimeline(scope)` + `useAddInternalNote()` (React Query).
7. Tests unitaires (mock supabase, comme `conversations.service.test.ts`).

**Étape C — Composants UI (réutilisables)**
8. `CommunicationTimeline` (présentation : groupes par jour, `TimelineEntryRow`, filtres canal/statut/recherche, composeur de note, états vide/chargement/erreur).
9. `CommunicationTimelineDrawer` (wrapper drawer pour Flowday).

**Étape D — Intégrations (3 emplacements, non destructives)**
10. Fiche client : section dépliable dans `ClientProfile360`.
11. Fiche réservation : onglet `communications` dans `ReservationDetailsModal`.
12. Flowday : item ⋮ « Journal » dans `OperationsTable` → drawer.
13. Invalidation du cache timeline après envoi (brancher sur `CommunicationModal`/Flowday) et après ajout de note.

**Étape E — Vérification**
14. `tsc` (0 nouvelle erreur), suite de tests verte, contrôle manuel des 3 emplacements, vérif RLS (isolation hôtel).

**Garanties** : `communication_logs` intact ; tout est additif ; rollback fourni ;
aucun écran existant n'est cassé (ajouts uniquement).

---

## Décisions à valider

1. **Emplacements** : section dépliable (fiche client) · 8ᵉ onglet « Journal » (réservation) · 4ᵉ item ⋮ + drawer (Flowday) — OK ?
2. **Notes internes** : la timeline doit-elle permettre d'**ajouter** une note (composeur), ou seulement les **afficher** ? (Recommandé : ajouter — sinon ce type d'entrée resterait vide.)
3. **Historique** : afficher l'historique `communication_logs` via **anti-jointure** (zéro migration de données, recommandé) plutôt qu'un backfill maintenant — OK ?
4. **Actions CRM** : démarrer avec **badges** (`guest_badge_history`, réel et certain). Faut-il aussi inclure les **incidents CRM** dès L3 ?
