# Guide formation Réception — Flowtym PMS Folkestone

**Public** : équipe réception Folkestone Opéra  
**Durée** : 4h sur 2 sessions de 2h  
**Pré-requis** : aucun  
**Support** : ce guide + démo live + captures écran annotées (à compléter S-2)

---

## 🧭 Navigation générale

- **Sidebar gauche** : modules (Flowday, Réservations, Clients, Revenue, RH, Settings)
- **Topbar** : sélecteur d'hôtel (si multi-hôtels), recherche globale, notifications, compte
- **Sidebar droite** (sur Planning) : intelligence du jour (occupation, pickup, événements)

### Raccourcis clavier
- `Cmd/Ctrl + K` : recherche globale (clients, réservations, factures)
- `Esc` : ferme modale en cours
- `?` : aide contextuelle sur certaines pages

---

## 1. Création de réservation

**Route** : Flowday → Planning (mode Gantt)

**Workflow** :
1. Vue Gantt sur le jour J → 15J → Mois selon besoin
2. **Drag-select** sur une chambre disponible (de date d'arrivée → date départ)
3. Modal "Nouvelle réservation" s'ouvre
4. Remplir :
   - Nom client (recherche auto si client existant)
   - Email, téléphone
   - Nombre de personnes
   - Plan tarifaire (BAR, NRF, package, etc.)
   - Source (Direct, Booking.com, etc.)
   - Politique d'annulation (auto selon plan)
5. **Vérifier le prix total** (TVA incluse selon plan)
6. Cliquer "Créer la réservation"

**Erreurs possibles** :
- "Chevauchement détecté" → la chambre n'est pas libre, choisir une autre
- "Email invalide" → format `prenom@domaine.com`
- "Date départ ≤ date arrivée" → vérifier les dates

**Cas particuliers** :
- **Walk-in** (arrivée immédiate) : `check_in = aujourd'hui`, créer + check-in dans la foulée
- **Réservation groupe** : créer 1 réservation par chambre, lier via "Groupe"
- **Surbooking accidentel** : le système bloque automatiquement (contrainte DB)

---

## 2. Check-in

**Route** : Flowday → Today (Flowday) OU Planning

**Workflow standard** :
1. Repérer la résa du jour (filtre "Arrivées du jour" sur Flowday)
2. Cliquer sur la résa → modale détails
3. Vérifier :
   - Identité client (pièce d'identité physique vs profil)
   - Mode de paiement saisi (carte préautorisée, espèces, etc.)
   - Demandes spéciales (vue, étage, fleurs, etc.)
4. Bouton **"Check-in"** → status passe à `checked_in`
5. Remettre la clé physique

**Cas particuliers** :
- **Arrivée anticipée** (avant 14h) : OK si chambre prête, sinon laisser bagages + retour à l'heure
- **Pièce d'identité manquante** : noter dans `special_requests`, demander à l'arrivée d'un proche

---

## 3. Check-out

**Route** : Flowday → Today OU fiche réservation

**Workflow** :
1. Repérer la résa du jour (filtre "Départs du jour")
2. Cliquer sur la résa → modale détails
3. Vérifier que la facture est **émise** (status `issued`) ET **soldée** (balance = 0)
4. Si non soldée → encaisser le solde (voir §5)
5. Cliquer **"Check-out"** → status passe à `checked_out`
6. Restituer la caution / clé

**Bloquant** : le système refuse le check-out si :
- Facture en `draft` → "Émettre la facture avant le départ" (voir §4)
- Balance > 0 → "Solde restant dû : X €. Veuillez encaisser le paiement avant le départ."

---

## 4. Facturation

**Route** : depuis fiche réservation → onglet "Billing"

**Workflow émission facture** :
1. Onglet "Billing" affiche le **folio** (récap des nuitées + extras)
2. Vérifier que toutes les prestations sont saisies (resto, mini-bar, blanchisserie, etc.)
3. Cliquer "Émettre la facture"
4. Status passe `draft → issued` + horodatage
5. La facture est désormais **verrouillée** sur les champs financiers (forensic audit actif)

**Ajout d'extras avant émission** :
- Cliquer "+ Ajouter ligne"
- Sélectionner produit / saisir libellé + montant TTC + TVA
- La ligne s'ajoute au folio

**Modification après émission** :
- Modification directe : **bloquée** (audit forensique)
- Pour corriger : créer un **avoir** (credit_note) qui annule la facture, puis re-créer une nouvelle facture corrigée

---

## 5. Encaissement paiement

**Route** : depuis fiche réservation → bouton "Encaisser paiement"

**Workflow** :
1. Modal "Nouveau paiement"
2. Renseigner :
   - Montant (€)
   - Méthode : `card`, `cash`, `transfer`, `cheque`, `other`
   - Référence (numéro CB tronqué, n° transfert, etc.)
   - Date d'encaissement (par défaut maintenant)
3. Valider

**Effet automatique** :
- `paid_amount` de la facture mis à jour
- `balance` recalculée
- Si balance ≤ 0 → status passe automatiquement à `paid`

**Annulation paiement** :
- Sélectionner le paiement dans la liste
- "Annuler" → crée un paiement négatif (reversal)
- L'original est marqué `reversed`

---

## 6. Recherche client (CRM)

**Route** : Clients → Fiches clients (ou `Cmd/Ctrl + K` puis "client:")

**Recherche** :
- Par nom / prénom
- Par email
- Par téléphone
- Par référence réservation

**Fiche client (Profil 360)** :
- Coordonnées + adresse
- Historique des séjours
- Notes internes
- Préférences (oreiller, étage, etc.)
- Documents (passeport scanné si stocké)
- Badges (VIP, fidèle, etc.)

**Création nouveau client** :
- Bouton "+ Nouveau client"
- Remplir nom + email minimum
- Les autres champs peuvent être complétés ultérieurement

**Doublons détectés** :
- Le système alerte sur email/téléphone identiques
- Fusion possible via "Fusionner avec…" (réservée à l'admin)

---

## 7. Cas particuliers réception

### Changement de chambre en cours de séjour
- Fiche réservation → onglet "Réservation"
- Modifier `room_id` → choisir nouvelle chambre dispo
- Vérification automatique des chevauchements

### Prolongation séjour
- Modifier `check_out` (plus tard)
- Vérification automatique de disponibilité

### Départ anticipé
- Modifier `check_out` (plus tôt)
- Recalculer facture si nécessaire

### No-show
- Le matin J+1 : marquer la résa "No-show"
- La politique d'annulation applique automatiquement les pénalités

### Annulation client
- Fiche résa → bouton "Annuler"
- Saisir motif
- Si payée → procéder remboursement selon politique

---

## 8. Communications client

**Route** : depuis fiche réservation → onglet "Communications"

**Envoyer email** :
- Bouton "+ Email"
- Template (confirmation, pre-arrival, post-departure)
- Personnaliser + envoyer

**Envoyer WhatsApp** (si activé) :
- Bouton "+ WhatsApp"
- Modèle approuvé Meta (si > 24h depuis dernier contact)
- Message libre (si dans fenêtre 24h)

**Historique** :
- Tous les messages sortants + entrants
- Statut : envoyé, livré, lu

---

## 🆘 En cas de problème

| Symptôme | Action immédiate |
|---|---|
| Page blanche / erreur | Refresh (F5). Si persiste → message canal WhatsApp pilote |
| "Cette facture est verrouillée" | Normal : émettre un avoir, ne pas chercher à modifier |
| "Chevauchement détecté" | Choisir autre chambre, ou modifier dates |
| "Solde restant dû" sur check-out | Encaisser solde d'abord |
| Connexion impossible | Vérifier email/password. Si forgot → "Mot de passe oublié" |

**Numéros support** :
- L1 (Réception) : entre vous
- L2 (Admin Flowtym) : __________ (à compléter)
- L3 (Dev) : urgences uniquement, via L2

---

## 📝 Aide-mémoire 1 page (à imprimer A4 plastifiable)

```
┌─────────────────────────────────────────────────────────────────────┐
│ FLOWTYM PMS — RÉCEPTION FOLKESTONE                                  │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│ 🆕 RÉSA       Planning → drag sur chambre → modal                  │
│ ✅ CHECK-IN   Today → fiche → bouton "Check-in"                    │
│ 💳 PAIEMENT   Fiche résa → "Encaisser paiement"                    │
│ 🧾 FACTURE    Fiche résa → onglet Billing → "Émettre"              │
│ 🚪 CHECK-OUT  Today → fiche → bouton "Check-out"                   │
│                                                                      │
│ ⚠ Check-out IMPOSSIBLE si :                                         │
│   - Facture pas émise → Émettre d'abord                              │
│   - Solde > 0 → Encaisser d'abord                                    │
│                                                                      │
│ 🔍 Cmd+K : recherche globale                                         │
│                                                                      │
│ 🆘 Problème → groupe WhatsApp "Pilote Folkestone"                   │
│   3 lignes : Quoi / Quand / Qui + capture si possible               │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

---

**Document vivant. À enrichir avec captures écran réelles annotées en S-2.**
