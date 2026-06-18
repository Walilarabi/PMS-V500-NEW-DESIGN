# Guide formation RH — Flowtym PMS Folkestone

**Public** : RH ou gestionnaire de paie Folkestone Opéra  
**Durée** : 3h  
**Pré-requis** : aucun

---

## 🧭 Modules RH

- Salariés (employees)
- Contrats (employee_contracts, generated_contracts)
- Planning (staff_planning)
- Absences (absence_requests, absence_balances)
- Pointages (staff_clockings)
- Portail salarié (accès employé)

---

## 1. Gestion des salariés

### Liste (RH → Salariés)

Affiche les 19 employés Folkestone (16 actifs, 3 inactifs).

**Filtres** :
- Rôle (réception, housekeeping, restauration, etc.)
- Département
- Status (actif, inactif, en congé)
- Type contrat (CDI, CDD, alternance, etc.)

### Création salarié

Bouton "+ Nouveau salarié"

Champs obligatoires :
- Prénom + Nom
- Date naissance + lieu
- Nationalité
- Rôle + département
- Type contrat
- Date d'embauche

Champs complémentaires :
- Email + téléphone + adresse
- Numéro sécurité sociale
- Permis de séjour (si applicable, avec expiration)
- Contact d'urgence
- Repos hebdo

### Modification

Clic sur ligne → modal détail → "Éditer"

**Cas particuliers** :
- **Départ salarié** : renseigner `departure_date` → désactive automatiquement le compte
- **Mise en pause** : status `paused` (ex : congé sabbatique, congé parental long)

---

## 2. Contrats

### Templates (RH → Contrats → Templates)

Folkestone a actuellement **1 template contrat** configuré.

Pour créer un nouveau template :
- Bouton "+ Nouveau template"
- Définir le nom (ex "CDI Réception 35h")
- Coller le corps avec variables (`{{first_name}}`, `{{salary}}`, etc.)
- Sauvegarder

### Génération contrat

Depuis fiche salarié → bouton "Générer contrat"
1. Choisir template
2. Renseigner :
   - Date début / date fin (si CDD)
   - Salaire brut mensuel
   - Heures hebdo
   - Période d'essai
3. Cliquer "Générer"
4. Le contrat est créé en status `draft` avec numéro automatique (CTR-2026-NNNN)

### Signature

Workflow :
1. Status `draft` → envoyer signature → Yousign ou SignatureRequest natif
2. Salarié reçoit lien email
3. Signature électronique
4. Status passe à `signed` + archive PDF dans bucket sécurisé

### Renouvellement / avenant

- Depuis contrat existant → bouton "Avenant"
- Modifier les champs nécessaires
- Nouveau contrat lié au source_contract_id
- Signature électronique pour validité

---

## 3. Planning

### Vue planning (RH → Planning)

Folkestone : 5476 lignes de planning actives sur la période.

Vue calendrier hebdomadaire avec :
- Lignes : salariés
- Colonnes : jours
- Cellules : shift (libellé + heures début/fin) OU absence (CP, RTT, MAL, etc.)

### Création d'un shift

- Cliquer sur une cellule vide → modal
- Choisir : shift type (matin, après-midi, soir, nuit), heures de début/fin, pauses

### Couverture / coverage rules

- Settings → Planning → Coverage rules
- Définir le nombre min de salariés par rôle / par shift / par jour
- Le système alerte si sous-effectif

### Réplication semaine

- Sélectionner semaine source → "Dupliquer vers semaine X"
- Adapter manuellement les exceptions

---

## 4. Absences

### Types d'absence (Settings → RH → Absence types)

5 types disponibles globalement :
- **CP** : Congé payé
- **RTT** : RTT
- **MAL** : Maladie
- **MAT** : Maternité
- **PAT** : Paternité

### Demande d'absence

**Côté salarié** (via portail) :
- Onglet "Mes absences"
- Bouton "+ Nouvelle demande"
- Choisir type, dates, demi-journée éventuelle, joindre justificatif (PDF, image)
- Soumettre → status `submitted`

**Côté manager** (vous) :
- RH → Absences → Demandes en attente
- Approuver / refuser avec motif
- Si approuvé : status `approved` + impact automatique sur planning + soldes

### Soldes (balances)

- RH → Salariés → fiche → onglet "Soldes congés"
- Affiche solde CP, RTT, etc.
- Mouvements détaillés (acquisitions, prises, ajustements)

---

## 5. Pointages

### Pointage QR (par défaut)

Chaque salarié pointe via QR code à l'entrée du staff.

- 1 scan = clock-in (matin)
- 2e scan = clock-out (soir)
- 3e/4e scans = pause

### Vue pointages (RH → Pointages)

- Liste chronologique des clockings
- Filtres par salarié, jour, semaine
- Détection anomalies (oublis, ouverture > 12h, etc.)

### Pointage manuel

Si oubli QR : RH peut saisir manuellement
- Source : `manual` (vs `qr`, `gps`, etc.)
- Notes obligatoires

### Heures supplémentaires

- Calculées automatiquement vs contrat
- Vue récap dans RH → Paie → Heures sup

---

## 6. Portail salarié

URL : la même que Flowtym PMS, mais le salarié voit un dashboard restreint après login.

**Salarié peut** :
- Voir son planning personnel
- Demander une absence
- Soumettre une feuille de pointage de correction
- Consulter ses bulletins (si module paie activé)
- Voir ses documents personnels (contrat, attestations)
- Modifier ses coordonnées personnelles

**Salarié ne peut PAS** :
- Voir les autres salariés
- Voir les données RH globales
- Accéder au PMS

---

## 7. Workflows critiques

### Recrutement → embauche

1. Module recrutement → candidatures
2. Sélectionner → bouton "Embaucher" → crée salarié + contrat draft
3. Renseigner date début, salaire, etc.
4. Signature contrat
5. Onboarding tasks (checklist)

### Visite médicale (si module actif)

- RH → Suivi médical
- Convoquer un salarié
- Renseigner résultat (apte, apte avec restriction, inapte)
- Renseigner prochaine date (auto + 24 mois)

### Départ salarié

1. Modifier `departure_date`
2. Modifier `status` à `departed`
3. Offboarding tasks (checklist : carte clé, équipement, badge accès, etc.)
4. Solde de tout compte

---

## 🆘 En cas de problème

| Symptôme | Action |
|---|---|
| Salarié ne peut pas se connecter au portail | Vérifier email + reset password |
| Planning ne se sauvegarde pas | F5 + retenter. Si persiste → canal WhatsApp pilote |
| Absence approuvée mais solde non décrémenté | Vérifier le mouvement dans soldes ; remonter si bug |
| Contrat refusé à la signature | Vérifier l'email du salarié + spam |

---

**Document vivant. À enrichir avec captures écran et exemples concrets en S-2.**
