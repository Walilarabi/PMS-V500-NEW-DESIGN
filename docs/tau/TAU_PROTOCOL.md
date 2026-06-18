# Protocole TAU — Test d'Acceptation Utilisateur Folkestone Opéra

**Date** : à exécuter J-3 avant lancement pilote  
**Durée** : 3h (2 personnes × 1h30 chacune)  
**Lieu** : Folkestone Opéra ou visio si nécessaire

---

## 🎯 Objectif

Valider que **chacun des 10 scénarios critiques** se déroule sans intervention support, en conditions réelles, avant le lancement du pilote.

**Critère de validation** : 10/10 scénarios doivent passer. Tout échec = report J0 + correction + re-test.

---

## 👥 Participants obligatoires

| Rôle | Participant | Activité TAU |
|---|---|---|
| Direction Folkestone | _________________ | Observe + valide scénarios 6-7 (RH) + 9 (Revenue) |
| Référent Folkestone (D8) | _________________ | Exécute tous les scénarios |
| Réception Folkestone | _________________ | Exécute scénarios 1-5 + 10 |
| RH Folkestone (si applicable) | _________________ | Exécute scénarios 6-8 |
| walilarabi (Flowtym) | walilarabi | Observe + assiste si besoin (sans intervenir si possible) |

---

## 📋 Les 10 scénarios

### Scénario 1 — Login + navigation

**Objectif** : valider que tous les utilisateurs peuvent se connecter et naviguer dans les modules autorisés.

**Étapes** :
1. Chaque utilisateur ouvre l'URL Flowtym
2. Login avec son email + mot de passe
3. Vérifier la sidebar : modules accessibles correspondent au rôle
4. Vérifier le sélecteur d'hôtel (doit afficher "Folkestone Opéra")
5. Tester `Cmd/Ctrl + K` pour la recherche globale

**Critère pass** :
- ✅ Tous les utilisateurs se connectent du premier coup
- ✅ Modules visibles cohérents avec le rôle
- ✅ Recherche globale fonctionnelle
- ✅ 0 erreur console (F12)

**Validation** : 🟢 PASS / 🔴 FAIL  
**Notes** : _________________________

---

### Scénario 2 — Création réservation walk-in

**Objectif** : valider le workflow de création complet d'une réservation immédiate.

**Étapes** :
1. Aller sur Flowday → Planning
2. Drag-select sur une chambre disponible du jour + 2 nuits
3. Modal "Nouvelle réservation" → remplir :
   - Nom : "Test Pentest Pilote"
   - Email : test+`<timestamp>`@flowtym.test
   - Téléphone : +33 6 00 00 00 00
   - Plan tarifaire : BAR
   - Adultes : 2
4. Cliquer "Créer la réservation"
5. Vérifier que la résa apparaît sur le planning
6. Vérifier le statut `confirmed`

**Critère pass** :
- ✅ Création sans erreur
- ✅ Résa visible sur planning
- ✅ Prix total calculé selon plan
- ✅ Email confirmation reçu (si P3 Email actif)

**Validation** : 🟢 / 🔴  
**Notes** : _________________________

---

### Scénario 3 — Modification réservation (dates + chambre)

**Objectif** : valider la modification d'une réservation existante.

**Étapes** :
1. Reprendre la résa créée au scénario 2
2. Modal détail → onglet "Réservation"
3. Modifier `check_out` : +1 nuit
4. Modifier `room_id` : choisir une autre chambre disponible
5. Sauvegarder
6. Ajouter une demande spéciale : "Petit-déjeuner en chambre"

**Critère pass** :
- ✅ Modifications sauvegardées
- ✅ Détection chevauchement si conflit (test : essayer une chambre occupée → doit refuser)
- ✅ Demande spéciale affichée

**Validation** : 🟢 / 🔴  
**Notes** : _________________________

---

### Scénario 4 — Check-in + check-out + facture + paiement

**Objectif** : valider le workflow PMS complet de bout en bout.

**Étapes** :
1. Reprendre la résa du scénario 3
2. Check-in :
   - Aller sur la résa
   - Bouton "Check-in"
   - Statut passe `confirmed → checked_in`
3. Génération facture :
   - Onglet "Billing"
   - Vérifier folio
   - Ajouter ligne extra : "Mini-bar 15€"
   - Cliquer "Émettre la facture"
   - Statut passe `draft → issued`
4. Encaissement paiement :
   - Bouton "Encaisser paiement"
   - Montant : total TTC
   - Méthode : `card`
   - Référence : "TEST-TAU-001"
   - Valider
   - Vérifier balance = 0 et statut `paid`
5. Check-out :
   - Bouton "Check-out"
   - Statut passe `checked_in → checked_out`

**Critère pass** :
- ✅ Tous les statuts transitent correctement
- ✅ Trigger checkout_guard NE bloque PAS car facture émise + balance 0
- ✅ Audit trail : aller voir `audit_logs` (admin → settings) → ligne pour création résa, modif, check-in, émission facture, paiement, check-out

**Test négatif obligatoire** (à faire avant l'étape 4) :
- Tenter de check-out AVANT d'émettre la facture → doit afficher "Facture en brouillon" ❌
- Tenter de check-out AVANT d'encaisser le paiement → doit afficher "Solde restant dû X €" ❌

**Validation** : 🟢 / 🔴  
**Notes** : _________________________

---

### Scénario 5 — Recherche client + historique

**Objectif** : valider la fonctionnalité CRM de base.

**Étapes** :
1. Clients → Fiches clients
2. Rechercher "Test Pentest Pilote" → trouver la fiche créée
3. Consulter l'historique : doit afficher la réservation du scénario 2-4
4. Consulter les communications (si Email actif)
5. Vérifier les badges éventuels (premier séjour, etc.)

**Critère pass** :
- ✅ Recherche fonctionne (par nom + email + téléphone)
- ✅ Historique complet et précis
- ✅ Pas de leak (les fiches d'autres hôtels = invisibles)

**Validation** : 🟢 / 🔴  
**Notes** : _________________________

---

### Scénario 6 — Création employé + contrat (RH)

**Objectif** : valider workflow RH de création employé.

**Étapes** :
1. RH → Salariés
2. + Nouveau salarié
3. Renseigner : Prénom "Test", Nom "TAU", Rôle "réception", Département "réception", Type contrat "CDD"
4. Date naissance + lieu (libre)
5. Date d'embauche : aujourd'hui
6. Sauvegarder
7. Depuis fiche → "Générer contrat"
8. Choisir template existant
9. Renseigner : Date début aujourd'hui, durée 3 mois, salaire 2000€, 35h
10. Générer

**Critère pass** :
- ✅ Employé créé avec id auto
- ✅ Contrat généré avec numéro (CTR-2026-NNNN)
- ✅ Statut contrat = `draft`

**Validation** : 🟢 / 🔴  
**Notes** : _________________________

---

### Scénario 7 — Demande absence + approbation

**Objectif** : valider workflow demande absence + approbation.

**Étapes** :
1. RH → Absences
2. Demander une absence pour l'employé "Test TAU" :
   - Type : CP
   - Du : J+10
   - Au : J+12
   - Justification : "Test TAU"
   - Soumettre → statut `submitted`
3. (en tant que manager) → approuver
4. Vérifier impact sur planning + soldes

**Critère pass** :
- ✅ Demande créée
- ✅ Status passe `submitted → approved`
- ✅ Solde CP décrémenté de 3 jours
- ✅ Planning affiche l'absence

**Validation** : 🟢 / 🔴  
**Notes** : _________________________

---

### Scénario 8 — Pointage QR

**Objectif** : valider workflow pointage.

**Étapes** :
1. RH → Pointages
2. Saisir manuellement pour l'employé "Test TAU" un pointage du jour :
   - Clock-in : 09:00
   - Source : `manual`
   - Notes : "Test TAU"
3. Sauvegarder → statut `open`
4. Saisir clock-out : 17:00
5. Statut passe `open → closed`

**Critère pass** :
- ✅ Pointage créé et clos correctement
- ✅ Durée calculée (8h - pause = 7h30)
- ✅ Visible dans la vue récapitulative

**Validation** : 🟢 / 🔴  
**Notes** : _________________________

---

### Scénario 9 — Dashboard Revenue mensuel

**Objectif** : valider l'accès aux indicateurs financiers.

**Étapes** :
1. Revenue → Dashboard
2. Période : mois en cours
3. Vérifier les KPIs :
   - Occupation moyenne
   - ADR
   - RevPAR
   - CA total
4. Aller sur Flowday → Planning → mode "Calendrier Revenue"
5. Cliquer sur 1 jour → modal détail
6. Vérifier que les chiffres correspondent

**Critère pass** :
- ✅ Aucune erreur (page ne crash pas)
- ✅ Chiffres cohérents avec la réalité (à comparer avec PMS actuel si en parallèle)
- ✅ Pas de leak entre hôtels (multi-tenant OK)

**Validation** : 🟢 / 🔴  
**Notes** : _________________________

---

### Scénario 10 — Création dispute SAS + envoi email (conditionnel)

**Objectif** : valider le workflow OTA dispute (uniquement si P3 Email actif).

**Étapes** :
1. SAS → OTA Dispute Center
2. + Nouvelle dispute :
   - Partenaire : Booking.com (à ajouter d'abord si pas configuré)
   - Référence : TAU-001
   - Montant attendu : 100€
   - Montant reçu : 80€
   - Explication : "Test TAU"
3. Modal "Preview email"
4. Cliquer "Envoyer" → l'email part vers `disputes@booking.com`

**Critère pass** :
- ✅ Dispute créée avec référence
- ✅ Email envoyé (statut `SENT`)
- ✅ Audit log enregistré
- ✅ Pas d'envoi cross-tenant (test : essayer un disputeId d'un autre hôtel → 403 attendu)

**Skip si** : P3 Email non actif au moment du TAU. Dans ce cas marquer "REPORT post-pilote".

**Validation** : 🟢 / 🔴 / 📅 REPORT  
**Notes** : _________________________

---

## 📝 Synthèse TAU

À remplir et signer en fin de TAU :

| Scénario | Pass / Fail | Notes / corrections |
|---|---|---|
| 1. Login + nav | 🟢 / 🔴 | |
| 2. Création résa | 🟢 / 🔴 | |
| 3. Modification résa | 🟢 / 🔴 | |
| 4. Check-in/out + fact + paiement | 🟢 / 🔴 | |
| 5. Recherche client + historique | 🟢 / 🔴 | |
| 6. Création employé + contrat | 🟢 / 🔴 | |
| 7. Absence + approbation | 🟢 / 🔴 | |
| 8. Pointage | 🟢 / 🔴 | |
| 9. Dashboard Revenue | 🟢 / 🔴 | |
| 10. SAS dispute | 🟢 / 🔴 / 📅 | |

**Décision** :
- [ ] 🟢 GO LANCEMENT — 10/10 ou 9/10 + scénario 10 reporté
- [ ] 🛑 NO GO — corrections nécessaires, report J0

**Cycle de correction si NO GO** :
- Identifier la cause racine
- Correctif (par walilarabi ou L3 dev)
- Re-test du scénario fail uniquement (pas nécessaire de re-tester les 10)
- Validation finale

---

## ✍️ Signatures

| Rôle | Nom | Signature | Date |
|---|---|---|---|
| Référent Folkestone | _____________ | ___________ | ____ |
| Direction Folkestone | _____________ | ___________ | ____ |
| Réception Folkestone | _____________ | ___________ | ____ |
| RH Folkestone | _____________ | ___________ | ____ |
| walilarabi (CTO Flowtym) | walilarabi | ___________ | ____ |

**Sans signatures complètes = pas de J0.**

---

**Document à archiver dans `docs/pilots/folkestone/TAU_RESULTS_<date>.md` après exécution.**
