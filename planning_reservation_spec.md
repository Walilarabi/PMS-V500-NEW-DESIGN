# Flowtym PMS — Logique complète de la réservation dans le Planning, Vue Jour, Module Réservations

## SOURCE : flowtym-pms-v2__3_.html — Code analysé ligne par ligne

---

## 1. ÉTAT GLOBAL (variables partagées entre tous les modules)

```javascript
// State global — partagé entre Planning, Réservations, Checkin
let reservations = [];        // Array source de vérité
let clients      = [];        // Cardex clients
let rooms        = [];        // Inventaire chambres (depuis CFG_ROOMS)
let planOffset   = 0;         // Décalage jours depuis aujourd'hui
let planViewDays = 15;        // 7 | 15 | 30 jours affichés
let planStatsVisible = true;  // Ligne KPI visible/cachée
let planKpiVisible   = true;  // Barre KPI haute visible/cachée
let planDragResaId   = null;  // ID en cours de glisser-déposer
let planModalCb      = null;  // Callback confirmation délogement

// Filtres module Réservations
let resaFilter   = '';        // Filtre texte libre
let resaStatusF  = '';        // Filtre statut
let resaCanalF   = '';        // Filtre canal
let resaPensionF = '';        // Filtre pension
```

---

## 2. MODULE PLANNING — Architecture complète

### 2.1 Rendu principal : `renderPlanning()`

**Déclencheurs :**
- Navigation vers `sec-planning`
- `shiftPlan(days)` — navigation temporelle
- `setPlanView(days)` — changement 7/15/30j
- `saveResa()` — après création/modification réservation
- `confirmCheckin()` — après check-in
- `doCheckout()` — après check-out
- `resaSetStatus()` — changement statut

**Structure HTML produite :**
```
<thead>
  <tr>
    <th sticky> Chambre </th>        // colonne sticky gauche 110px min-width
    <th class="today-col">          // colonne aujourd'hui (surlignée)
    <th class="weekend-col">        // samedis/dimanches (fond différent)
    ...
  </tr>
</thead>
<tbody>
  <tr> // une ligne par chambre filtrée
    <td class="rlbl" sticky>        // label chambre : Ch. 101 · double · 99€
    <td class="plan-cell [today] [weekend] [occupied]"
        ondragover ondragleave ondrop onclick>
      <span class="plan-resa [canal] [arrival-bar] [departure-bar] [dummy-bar]"
            draggable="true"
            ondragstart ondragend onclick>
        🟢/🟠/⚪ NomAbrégé
      </span>
    </td>
    ...
  </tr>
  // Ligne statistiques (masquable)
  <tr class="plan-stat-row">  // Dispo/TO%
  <tr class="plan-stat-row">  // ADR
  <tr class="plan-stat-row">  // Événements
</tbody>
```

**Classes CSS de la barre réservation (`.plan-resa`) :**
| Classe | Signification |
|---|---|
| `direct` | Canal Direct |
| `booking` | Booking.com |
| `expedia` | Expedia |
| `airbnb` | Airbnb |
| `walkin` | Walk-in |
| `arrival-bar` | Jour d'arrivée (bord gauche arrondi) |
| `departure-bar` | Jour de départ (bord droit arrondi) |
| `dummy-bar` | Chambre fictive (paiement en attente) |
| `dragging` | En cours de glisser (ajouté dynamiquement) |

**Badge dans la barre :**
- `🟢` = jour d'arrivée (`isArr`)
- `🟠` = jour de départ (`isDep`)
- `⚪` = nuit intermédiaire

**Nom affiché :** Prénom + initiale Nom (`Martin D.`)

---

### 2.2 Filtre des réservations : `planResasForRoom(roomNum, dateStr)`

Retourne les réservations actives pour une chambre/date donnée.

**Règles métier :**
```javascript
// Exclure les annulées
if (r.status === 'Annulee') return false;

// Correspondance chambre
if (r.room !== roomNum) return false;

// Parser de date robuste (format "07 avr. 2026 – 10 avr. 2026")
// → gère l'absence d'année dans la première partie
const s = parseDate(parts[0], r.dates);
const e = parseDate(parts[1], r.dates);

// La date courante est >= arrivée ET < départ (convention hôtelière)
return ds >= s && ds < e;
```

**⚠️ Problème connu :** Le parser de dates est fragile (format FR "avr." vs "avr").
**Correction en production :** Stocker `checkin/checkout` en ISO `YYYY-MM-DD`.

---

### 2.3 KPIs par colonne : `planKpiForDate(dateStr)`

Calcule en temps réel pour chaque date :
```javascript
{
  to:     // Taux d'occupation % (occ/total*100)
  adr:    // Prix moyen (rev/occ)
  revpar: // RevPAR (rev/total)
  free:   // Chambres libres (total-occ)
  arr:    // Arrivées du jour
  dep:    // Départs du jour
}
```

**Couleurs TO% :**
- `>= 80%` → vert (`var(--green)`)
- `< 40%`  → rouge (`var(--red)`)
- Sinon   → violet (`var(--violet)`)

---

### 2.4 Navigation temporelle

```javascript
// Décaler la vue
shiftPlan(days)   // days=0 → revenir à aujourd'hui

// Changer le nombre de jours
setPlanView(7|15|30)

// Raccourci clavier
kbGoToToday()     // planOffset=0 + renderPlanning()
```

---

## 3. GLISSER-DÉPOSER (Drag & Drop) — Logique complète

### 3.1 Démarrage : `planStartDrag(e, resaId)`

```javascript
function planStartDrag(e, resaId) {
  planDragResaId = resaId;
  e.currentTarget.classList.add('dragging');  // Feedback visuel
  e.dataTransfer.effectAllowed = 'move';
  e.dataTransfer.setData('text/plain', String(resaId));
}
```

**HTML source :**
```html
<span class="plan-resa ..."
  draggable="true"
  ondragstart="planStartDrag(event, RES-1234)"
  ondragend="this.classList.remove('dragging')"
  onclick="event.stopPropagation(); openResaModal('RES-1234')">
```

**Feedback cellule cible :**
```html
<td ...
  ondragover="event.preventDefault(); this.classList.add('drag-over')"
  ondragleave="this.classList.remove('drag-over')"
  ondrop="planDrop(event, '101', '2026-05-15')">
```

---

### 3.2 Dépôt : `planDrop(e, toRoom, dateStr)` — Arbre de décision complet

```
planDrop appelé
│
├── planDragResaId null ? → return (drop invalide)
│
├── Trouver réservation + client
│   └── Introuvable ? → return
│
├── fromRoom === toRoom ? → return (pas de changement)
│
├── Conflit ? (chambre déjà réservée sur la période)
│   └── OUI → toast "❌ Conflit" + return
│
├── Comparer niveau catégorie (roomLevel)
│   ├── roomLevel(toRoom) > roomLevel(fromRoom) → type='upgrade'
│   ├── roomLevel(toRoom) < roomLevel(fromRoom) → type='downgrade'
│   └── égaux → type='simple'
│
├── type='simple'
│   └── Déplacer directement (sans confirmation)
│       client.room = toRoom
│       r.room = toRoom
│       toast "✅ → Ch. X"
│       renderPlanning()
│
└── type='upgrade' | 'downgrade'
    └── planShowModal(icon, title, msg, callback)
        └── Sur confirmation :
            client.room = toRoom
            r.room = toRoom
            toast + renderPlanning()
```

**Niveaux de catégorie (`roomLevel`) :**
```javascript
function roomLevel(r) {
  if (r.type === 'suite') return 3;
  if (r.price >= 160)    return 2;
  return 1;
}
```

---

### 3.3 Modal de confirmation délogement : `planShowModal(icon, title, msg, cb)`

Structure DOM fixe (doit exister dans le HTML) :
```html
<div id="plan-confirm-modal">
  <div id="plan-modal-icon"></div>
  <div id="plan-modal-title"></div>
  <div id="plan-modal-msg"></div>
  <button onclick="planModalConfirm()">Confirmer</button>
  <button onclick="planModalCancel()">Annuler</button>
</div>
```

**Messages par type :**

| Type | Icône | Titre | Message |
|---|---|---|---|
| `upgrade` | ✨ | Upgrade détecté ! | "Déplacer [nom] vers Ch. [X] (catégorie supérieure) ? ↑ Upgrade" |
| `downgrade` | 📉 | Downgrade | "Déplacer [nom] vers Ch. [X] (catégorie inférieure) ? ↓ Vérifier tarif" |

**Callbacks :**
```javascript
planModalConfirm()  // Exécute planModalCb() puis reset
planModalCancel()   // Reset sans action
```

---

### 3.4 Clic sur cellule vide : `planCellClick(room, dateStr)`

```javascript
function planCellClick(room, dateStr) {
  // Ne pas ouvrir si drag en cours
  if (!planDragResaId) {
    openResaModal(null, { room, date: dateStr });
  }
}
```

→ Ouvre le formulaire de nouvelle réservation pré-rempli avec la chambre et la date cliquée.

---

## 4. FICHE RÉSERVATION DANS LE PLANNING

### 4.1 Clic sur barre réservation

```javascript
// Dans renderPlanning() :
onclick="event.stopPropagation(); openResaModal('RES-1234')"
```

`stopPropagation()` empêche le `planCellClick()` parent de se déclencher.

### 4.2 Ce qu'affiche `openResaModal(id)` en mode édition

La modal latérale (side modal) affiche :

**Section Client :**
- Nom complet (pré-rempli depuis `clients[]`)
- Email, Téléphone, Société
- Adultes, Enfants

**Section Séjour :**
- Dates Arrivée / Départ (readonly ou éditable)
- Durée calculée en nuits
- Canal de distribution (badge coloré)

**Section Chambre & Tarification :**
- Catégorie, Numéro de chambre
- Pension (Room Only / B&B)
- Plan tarifaire (Flex / NRF)
- Prix/nuit affiché

**Section Récapitulatif financier :**
- HT, TVA 10%, Taxe séjour 2,50€/nuit/pers.
- **Total TTC** (grand format violet)
- Solde restant dû

**Section Statut paiement :**
- Badge statut : `pending_payment` | `payment_link_expired` | `payment_reminder_sent` | `confirmed`
- Lien de paiement actif (si présent) avec countdown expiration
- Chambre fictive (🔷) si `isDummyRoom`

**Section Garantie :**
- Type garantie sélectionné (CB / Virement / Espèces / etc.)
- Statut : En attente | Préautorisé | Payé
- Règle préautorisation : Vérification | 1ère nuitée | Total séjour

**Workflow paiement :**
- Étape 1 : Générer lien (PSP Stripe/PayPal, % acompte, validité)
- Étape 2 : Envoyer confirmation (débloqué après génération lien)

**Footer :**
- 📄 Proforma PDF | ✉️ Confirmation email | Checkbox "Envoyer"
- Boutons : Annuler | Mettre à jour

---

### 4.3 Statuts de paiement affichés sur la barre planning

Dans `renderPlanning()`, les barres reflètent :
- **Couleur canal** : classe CSS `direct/booking/expedia/airbnb/walkin`
- **`dummy-bar`** : réservation avec chambre fictive (paiement non reçu)
- **`arrival-bar`** : bord gauche arrondi uniquement (arrivée)
- **`departure-bar`** : bord droit arrondi uniquement (départ)

---

## 5. ACTIONS SUR UNE RÉSERVATION — MENU COMPLET

### 5.1 `resaQuickAction(id)` — Menu contextuel "⋯"

Accessible depuis :
- Le bouton "⋯" dans la liste Réservations
- (Futur : clic droit sur barre planning)

**Actions disponibles selon statut :**
```javascript
openSM(`Actions — ${r.id}`, [
  // Toujours disponible
  "✏ Modifier"              → openResaModal(id)

  // Si status === 'Confirmee'
  "↗ Check-in direct"       → resaSetStatus(id, 'checked_in')

  // Si status === 'checked_in'
  "↙ Check-out direct"      → resaSetStatus(id, 'checked_out')

  // Toujours disponible
  "📄 Proforma PDF"         → resaProformaById(id)
  "✉️ Confirmation email"   → resaSendConfirmationById(id)

  // Si status !== 'Annulee'
  "✕ Annuler réservation"   → resaSetStatus(id, 'Annulee')
])
```

---

### 5.2 `resaSetStatus(id, status)` — Changement de statut

```javascript
function resaSetStatus(id, status) {
  const r = reservations.find(x => x.id === id);
  r.status = status;
  // Labels affichés en toast
  const labels = {
    checked_in:  'check-in effectué',
    checked_out: 'check-out effectué',
    Annulee:     'annulée'
  };
  toast(`Réservation ${id} — ${labels[status]}`, 'ok');
  renderResas();
  if (curSP === 'checkin') renderCheckin();
}
```

**États possibles :**
| Valeur | Label | Pill CSS |
|---|---|---|
| `Confirmee` | Confirmée | `pg` (vert) |
| `checked_in` | En séjour | `pv` (violet) |
| `checked_out` | Check-out | `pp` (gris) |
| `Annulee` | Annulée | `pr` (rouge) |
| `no_show` | No Show | `pa` (amber) |

---

### 5.3 Upgrade / Downgrade via glisser-déposer

**Upgrade (catégorie supérieure) :**
- Détecté : `roomLevel(toRoom) > roomLevel(fromRoom)`
- Modal de confirmation avec mention "↑ Upgrade"
- Action : `r.room = toRoom` + `client.room = toRoom`
- ⚠️ **Manque en prod :** Recalcul automatique du tarif selon la nouvelle chambre

**Downgrade (catégorie inférieure) :**
- Détecté : `roomLevel(toRoom) < roomLevel(fromRoom)`
- Modal avec mention "↓ Vérifier tarif"
- Même action côté données
- ⚠️ **Manque en prod :** Alerte sur perte de revenu + ajustement tarifaire

**Délogement simple (même niveau) :**
- Aucune confirmation requise
- Déplacement immédiat

---

### 5.4 Accès à la facturation depuis une réservation

**Chemin actuel :**
```
openResaModal(id)
  → Footer : bouton 📄 Proforma PDF
    → resaProforma() : génère PDF dans nouvelle fenêtre
  → Footer : bouton ✉️
    → resaSendConfirmationById(id) : ouvre mailto avec corps HTML
```

**Production (à connecter) :**
```
openResaModal(id)
  → "Accéder à la facturation"
    → naviguer vers sec-facturation
    → pré-charger la réservation dans le module facture
    → permettre création facture définitive FA-YYYY-XXXX
```

---

## 6. MODULE RÉSERVATIONS — Vue liste

### 6.1 Structure `renderResas()`

**Colonnes du tableau :**
| # | Colonne | Données |
|---|---|---|
| 1 | Référence | `r.id` (monospace, gris) |
| 2 | Statut | `statusPill(r.status)` + `pmStatusPill(r.paymentStatus)` |
| 3 | Client | `c.name` + `c.email` |
| 4 | Dates | `r.dates` + `r.nights` nuits |
| 5 | Chambre | `r.room` + `r.categoryLabel` + badge Fictive si `isDummyRoom` |
| 6 | Options | Pension (B&B/RO) + Annulation (NRF/Flex) |
| 7 | Canal | Pill colorée |
| 8 | Montant | `r.montant` TTC |
| 9 | Solde | `r.solde` (rouge si > 0, vert si soldé) + countdown expiration |
| 10 | Actions | ✏ Modifier | ⋯ Actions rapides |

**Couleurs de fond par priorité :**
```javascript
if (isExpired)  rowBg = 'background:#fff1f2'  // rouge pâle
if (isPending)  rowBg = 'background:#fffbeb'  // amber pâle
if (isRemind)   rowBg = 'background:#eff6ff'  // bleu pâle
if (isOvd)      rowBg = 'background:amber-l'  // passée
```

---

### 6.2 KPIs module Réservations

```javascript
rk1: Confirmée     (count)
rk2: En séjour     (count)
rk3: Annulée       (count)
rk4: No Show       (count)
rk-pending: En attente paiement (count, orange si > 0)
rk5: CA Total      (somme montants)
rk6: Soldes dus    (somme soldes réservations actives)
```

---

### 6.3 Filtres actifs

```javascript
resaFilter   → texte (nom, chambre, canal, id, catégorie)
resaStatusF  → statut réservation OU statut paiement
resaCanalF   → canal distribution
resaPensionF → 'room_only' | 'bed_breakfast'
```

---

### 6.4 Dashboard suivi expirations paiement

```javascript
renderExpiryDashboard() → DOM elements :
  exp-pending-ct   // En attente (pending + reminded)
  exp-expiring-ct  // Expirent < 6h
  exp-expired-ct   // Liens expirés
  exp-dummy-ct     // Chambres fictives en attente
```

---

## 7. VUE JOUR / CHECK-IN (sec-checkin) — `renderCheckin()`

### 7.1 Trois listes

**Arrivées du jour :**
```javascript
reservations.filter(r =>
  !['Annulee', 'checked_out'].includes(r.status) &&
  r.checkin === TODAY &&
  r.status !== 'checked_in'
)
```
→ Bouton "Check-in" → `openCheckinModal(clientId)`

**Départs du jour :**
```javascript
reservations.filter(r =>
  r.checkout === TODAY &&
  r.status === 'checked_in'
)
```
→ Bouton "Check-out" → `doCheckout(clientId)`

**En séjour :**
```javascript
reservations.filter(r => r.status === 'checked_in')
```
→ Boutons : Fiche | Check-out

---

### 7.2 Processus Check-in : `openCheckinModal(clientId)`

**Détection scan ID :**
```javascript
scanMode = c.hasVisited ? 'optional' : 'required'
```

**OCR réel :**
```javascript
// Tesseract.js (Vanilla JS)
const { data: { text } } = await Tesseract.recognize(file, 'fra+eng');
const match = nameParts.some(p => p.length > 2 && upper.includes(p));
window.ocrOK = match;
```

**Simulation OCR :**
```javascript
simulateOCR(clientId) → setTimeout 1200ms → ocrOK = true
```

**Validation finale : `confirmCheckin(clientId, scanMode)`**
```javascript
// Blocage si nouveau client sans scan
if (scanMode === 'required' && !window.ocrOK) {
  toast('ERREUR : scan ID obligatoire', 'err');
  return;
}

// Mise à jour client
c.status = 'checked_in';
c.hasVisited = true;
c.idVerified = window.ocrOK || c.idVerified;
c.visits++;

// Synchronisation réservation
resa.status = 'checked_in';
resa.checkinAt = new Date().toISOString();

// Re-render
renderCheckin();
if (curSP === 'planning') renderPlanning();
```

---

### 7.3 Processus Check-out : `doCheckout(clientId)`

```javascript
function doCheckout(clientId) {
  // Confirmation navigateur (à remplacer par modal custom)
  if (!confirm(`Confirmer le check-out de ${c.name} ?`)) return;

  c.status = 'checked_out';
  resa.status = 'checked_out';
  resa.checkoutAt = new Date().toISOString();

  renderCheckin();
  if (curSP === 'planning') renderPlanning();
}
```

**⚠️ Manque critique en prod :**
- Pas de génération automatique de facture au check-out
- Pas de création de tâche ménage (`room_cleaning_tasks`)
- Pas de mise à jour statut chambre (`rooms.status = 'to_clean'`)

---

## 8. MOTEUR DE PAIEMENT — Cycle de vie complet

### 8.1 Statuts de paiement

```
pending_payment        → Lien généré, en attente paiement client
payment_link_expired   → Lien expiré (auto après délai)
payment_reminder_sent  → Rappel envoyé (nouveau lien v2, v3...)
confirmed              → Paiement reçu et confirmé
```

### 8.2 Machine à états paiement

```
[Création réservation]
       │
       ▼
 pmGenerate()
       │
       ▼
 paymentStatus = 'pending_payment'
 paymentLinkExpiry = Date + 48h
 isDummyRoom = false (chambre réelle gardée)
       │
       │ Polling toutes 60s
       ▼
 pmHoursLeft < 0 ?
       │
       ├── OUI → paymentStatus = 'payment_link_expired'
       │          isDummyRoom = true
       │          room = DUMMY_ROOMS[category]
       │          Alerte visuelle 30s
       │
       └── NON, pmHoursLeft < 6h ?
              │
              └── Alerte toast préventive (_alerted flag)
                         │
                         ▼
              pmSendReminderById(id)
                    │
                    ├── Nouveau lien (+ 48h)
                    ├── paymentStatus = 'payment_reminder_sent'
                    ├── paymentLinkVersion++
                    └── reminderCount++
                         │
                         ▼
              pmConfirmPaymentById(id)
                    │
                    ├── isDummyRoom → chercher chambre réelle
                    ├── paymentStatus = 'confirmed'
                    └── paymentLink = null
```

### 8.3 Chambres fictives (DUMMY_ROOMS)

```javascript
const DUMMY_ROOMS = {
  double_classic:    { code: 'RES-D1', label: '🔷 Fictive Classique' },
  double_deluxe:     { code: 'RES-D2', label: '🔷 Fictive Deluxe' },
  suite:             { code: 'RES-D3', label: '🔷 Fictive Suite' },
  // ...
};
```

---

## 9. INTÉGRATION DANS UN ENVIRONNEMENT REACT/TYPESCRIPT

### 9.1 Structure de composants recommandée

```
src/
  components/
    planning/
      PlanningGrid.tsx          // Grille principale rooms × dates
      PlanningCell.tsx          // Cellule individuelle (drag target)
      ReservationBar.tsx        // Barre réservation (draggable)
      DelogementModal.tsx       // Confirmation upgrade/downgrade
      PlanningKpiRow.tsx        // Ligne statistiques
    reservations/
      ReservationList.tsx       // Tableau liste
      ReservationQuickMenu.tsx  // Menu "⋯" actions
      PaymentDashboard.tsx      // Suivi expirations
    checkin/
      CheckinView.tsx           // Vue jour
      CheckinModal.tsx          // OCR + signature
    shared/
      ReservationFormModal.tsx  // Formulaire unifié (déjà fait ✅)
  hooks/
    useAvailableRooms.ts        // Supabase (déjà fait ✅)
    usePlanningDrag.ts          // DnD state
    usePaymentPolling.ts        // Timer expirations
  stores/
    reservationStore.ts         // Zustand
    planningStore.ts            // Zustand
```

### 9.2 Hook `usePlanningDrag`

```typescript
function usePlanningDrag() {
  const [dragId, setDragId]     = useState<string|null>(null);
  const [confirmModal, setModal] = useState<ConfirmModalState|null>(null);

  const startDrag = useCallback((resaId: string) => setDragId(resaId), []);

  const handleDrop = useCallback(async (toRoom: string, dateStr: string) => {
    if (!dragId) return;
    const resa = reservationStore.getById(dragId);
    if (!resa) return;

    // Vérifier conflit Supabase
    const conflict = await checkRoomAvailability(toRoom, resa.checkIn, resa.checkOut, dragId);
    if (conflict) { toast('Conflit : chambre déjà réservée', 'err'); return; }

    const fromLevel = roomLevel(roomsStore.getByNum(resa.room));
    const toLevel   = roomLevel(roomsStore.getByNum(toRoom));

    if (toLevel === fromLevel) {
      await moveReservation(dragId, toRoom); // Direct
    } else {
      setModal({
        type:   toLevel > fromLevel ? 'upgrade' : 'downgrade',
        resaId: dragId,
        toRoom,
        onConfirm: () => moveReservation(dragId, toRoom),
      });
    }
  }, [dragId]);

  return { dragId, startDrag, handleDrop, confirmModal, setModal };
}
```

### 9.3 Supabase — Requêtes critiques à implémenter

```sql
-- Disponibilité chambre (pour DnD + formulaire)
SELECT room_num FROM reservations
WHERE status NOT IN ('annulee', 'no_show', 'checked_out')
  AND check_in  < $checkout
  AND check_out > $checkin
  AND id != $editId;

-- KPI par date (pour ligne statistiques)
SELECT COUNT(*) as occ,
       AVG(r.montant / r.nights) as adr
FROM reservations r
JOIN rooms rm ON rm.num = r.room_num
WHERE r.check_in <= $date
  AND r.check_out > $date
  AND r.status NOT IN ('annulee', 'no_show');

-- Polling expirations (remplace setInterval JS)
SELECT id, payment_link_expiry, payment_status, client_id
FROM reservations
WHERE payment_status IN ('pending_payment', 'payment_reminder_sent')
  AND payment_link_expiry < NOW() + INTERVAL '6 hours';
```

---

## 10. RÉCAPITULATIF DES DETTES TECHNIQUES

| Dette | Impact | Priorité |
|---|---|---|
| Parser dates FR fragile | Bugs d'affichage planning | 🔴 P0 |
| DnD pas de recalcul tarif upgrade/downgrade | Perte revenu | 🔴 P0 |
| checkout sans facture auto ni ménage | Non-conformité process | 🔴 P0 |
| confirm() navigateur pour checkout | UX dégradée | 🟠 P1 |
| setInterval JS pour polling paiements | Supabase Realtime disponible | 🟠 P1 |
| Pas de Supabase Realtime sur planning | Multi-user impossible | 🟠 P1 |
| roomLevel basé sur price >= 160 | Fragile, non paramétrable | 🟡 P2 |
| DUMMY_ROOMS hardcodés | Non configurable par hôtel | 🟡 P2 |

