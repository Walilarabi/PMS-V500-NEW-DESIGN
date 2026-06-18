# Guide formation Direction — Flowtym PMS Folkestone

**Public** : direction Folkestone Opéra (1-2 personnes)  
**Durée** : 6h en 1 ou 2 sessions  
**Pré-requis** : aucun (le guide Réception peut être lu en complément)

---

## 🧭 Modules Direction

La direction a accès à TOUS les modules (rôle `direction` ou supérieur). Ce guide se concentre sur 3 zones critiques :

1. Reporting financier + comptable
2. Revenue Management
3. Administration hôtel + utilisateurs

---

## 1. Reporting financier

### Dashboard Revenue (Revenue → Dashboard)

KPIs principaux affichés sur la période sélectionnée (jour / 7J / 30J / mois) :
- **Occupation moyenne** (% de chambres vendues)
- **ADR** (Average Daily Rate, € par chambre vendue)
- **RevPAR** (Revenue per Available Room, € par chambre disponible)
- **CA total** (chiffre d'affaires)
- **Pickup** (nouvelles réservations sur dernière période)

**Comparaisons** :
- vs période précédente (J-1, S-1, M-1)
- vs même période N-1 (année dernière)
- vs forecast

### Calendrier Revenue (Flowday → Planning → mode "Calendrier Revenue")

Vue calendrier mensuelle avec score de Revenue Intelligence par jour :
- Score 85+ : ✅ excellent
- Score 75-85 : 🟢 bon
- Score 65-75 : 🟡 moyen
- Score < 65 : 🔴 difficile

Clic sur 1 jour → modal détail (revenus, événements, pickup).

### Factures émises (Finance → Facturation)

Liste de toutes les factures avec filtres :
- Status (draft, issued, sent, paid, overdue, voided)
- Période
- Client
- Montant

**Export** :
- CSV / PDF par facture
- **FEC** (Fichier des Écritures Comptables) pour comptable / contrôle fiscal

### Audit financier (Finance → Audit Chain)

Toutes les opérations financières sont tracées dans une **chaîne cryptographique SHA-256 inaltérable**. Permet de prouver l'intégrité comptable en cas de contrôle.

---

## 2. Revenue Management (RMS)

### RMS Tableau Pro (Revenue → Pricing & Recommandations)

Vue tableau jour par jour sur 7/15/30/60/90 jours avec :
- Prix actuel BAR (de votre calendrier tarifaire)
- Médiane marché (compset OTAs)
- **Prix recommandé** par le moteur RMS (jamais 0 €, garde-fou actif)
- Stratégie suggérée (Agressive, Équilibrée, Défensive, etc.)
- Confiance IA (0-100%)
- Statut (En attente, Acceptée, Refusée, Maintenue)

**Acceptation manuelle** :
- Bouton "Accepter" → met à jour le calendrier tarifaire
- Bouton "Refuser" → conserve le prix actuel (avec raison)
- Bouton "Maintenir" → idem refuser mais sans raison obligatoire

### Calendrier tarifaire (Revenue → Calendrier tarifaire)

Grille de prix par chambre × plan tarifaire × date.
- Édition directe d'une cellule (clic)
- Édition en masse (sélection + valeur)
- Copier/coller des prix
- Restrictions (min stay, CTA, CTD)

### Autopilote RMS (Revenue → Autopilote)

Niveau d'automatisation :
- **Niveau 1** : suggestions uniquement (humain valide tout)
- **Niveau 2** : validation assistée
- **Niveau 3** : autopilote partiel (push automatique si garde-fous respectés)
- **Niveau 4** : autopilote total

**Garde-fous configurables** :
- Tarif plancher / plafond
- Variation max / jour (€ et %)
- Confiance IA minimale
- Exceptions (types chambre, canaux, périodes, événements)
- Lead time court (J-3 max %)

**Recommandation pilote** : commencer en **Niveau 1** (suggestions), passer Niveau 2 après 2 semaines de confiance, ne pas activer 3/4 pendant le pilote.

### Stratégies (Revenue → Stratégies)

8 stratégies prédéfinies avec scoring temps réel selon signaux marché :
- Agressive, Équilibrée, Défensive
- Yield Max, Haute demande, Last Minute
- Occupation faible, Opportuniste

Activable manuellement OU mode auto (sélection IA).

### Veille concurrentielle (Revenue → Marché & Concurrence)

Si Lighthouse API connectée :
- Tarifs compset par jour
- Position vs concurrents
- Recommandations d'ajustement

⚠️ Pour le pilote Folkestone : Lighthouse non activée → ce module affichera "Mode démo" ou données limitées.

---

## 3. Administration

### Paramétrage hôtel (Settings → Hôtel)

- Informations légales (raison sociale, SIRET, TVA, adresse)
- Logo + branding
- Politique générale (CGV, conditions d'annulation)
- TVA appliquée
- Numérotation factures (préfixe + séquence)

### Chambres & Inventaire (Settings → Chambres)

- Liste des chambres (numéro, type, catégorie, étage, surface)
- Statut housekeeping
- Tarif base / max
- Activation/désactivation

### Plans tarifaires (Settings → Tarifs & Prestations)

- Liste des plans (Folkestone en a 82 actifs)
- Code, nom, type repas, canal
- Plan de référence (BAR)
- Politique d'annulation
- Restrictions (min/max stay)

### Utilisateurs & Permissions (Settings → Utilisateurs)

**Liste des comptes** :
- Email, nom, rôle, statut (actif/inactif)
- Dernière connexion
- Hôtel actif

**Inviter un utilisateur** :
- Bouton "+ Inviter"
- Email + rôle (admin_hotel, direction, reception, housekeeping, etc.)
- Email d'invitation envoyé via Edge Function `invite-user`

**Rôles disponibles** :
- `admin_hotel` : tous droits sur l'hôtel
- `direction` : tous modules, pas d'admin technique
- `reception` : PMS + facturation + paiements + clients
- `housekeeping` : ménage uniquement
- `maintenance` : maintenance uniquement
- Autres : selon enum `admin_user_role`

**Changement d'hôtel** :
- Si vous avez accès à plusieurs hôtels → sélecteur topbar
- Le contexte change instantanément

### Partenaires OTA (Settings → SAS → Partenaires)

- Liste des partenaires OTA (Booking, Expedia, Airbnb, Direct)
- Email dispute (pour OTA dispute center)
- Commissions

⚠️ Folkestone : 0 partenaire SAS configuré actuellement. À ajouter si dispute OTA prévu.

### Configuration communication (Settings → Communication)

- **Email** : provider (Resend/SMTP), from email, from name, templates
- **WhatsApp** : phone_number_id Meta, access token (lu depuis Supabase secrets)
- Templates :
  - Confirmation réservation
  - Pré-arrivée (J-1)
  - Post-départ (avis client)
  - Reset password

⚠️ Folkestone : email transactionnel **non configuré actuellement** — c'est la **Priorité 3** pilote.

### Sauvegardes (Settings → Sécurité → Sauvegardes)

- État des sauvegardes Supabase managed
- Bouton "Lancer sauvegarde manuelle" → actuellement retourne `501 NOT_IMPLEMENTED` (V8 sprint-1, prévu Sprint 4 différé)
- Les snapshots Supabase Pro restent actifs avec PITR 7 jours

---

## 4. Cas particuliers Direction

### Annulation d'une facture émise

- Émettre un avoir (credit_note) — RPC `create_credit_note`
- Ne JAMAIS modifier directement les champs financiers (bloqué par futur trigger Sprint 4, mais bonne pratique dès maintenant)

### Recalcul tarification après changement plan

- Voir RMS Tableau Pro → "Rafraîchir" pour recalcul

### Audit utilisateur

- Settings → Sécurité → Journal d'audit
- Filtrer par utilisateur / période / type d'action

### Export FEC fin de mois

- Finance → Exports → FEC
- Format conforme art. A47 A-1 (France)
- Hash SHA-256 inclus pour intégrité

---

## 5. Reporting hebdomadaire pilote

Pendant les 8 semaines du pilote, recommandation : revue chaque vendredi avec walilarabi (Flowtym) :

**Métriques à consulter** :
1. Dashboard Revenue (CA, occupation, ADR, RevPAR)
2. Nombre d'utilisateurs actifs (Settings → Utilisateurs → filtres)
3. Tickets de support remontés (canal WhatsApp pilote)
4. Erreurs détectées (Sentry — accès à demander à walilarabi)
5. Incidents disponibilité (UptimeRobot status page)
6. Modifications suspectes factures (vue audit_alerts si déployée)

---

## 🆘 Procédure incident côté Direction

Pour les incidents techniques → canal WhatsApp pilote, format incident standard.

Pour les **incidents métier graves** (perte de donnée apparente, fraude, etc.) :
1. Stopper l'activité concernée
2. Capture d'écran
3. Notification immédiate walilarabi (téléphone)
4. Documentation post-mortem dans les 72h

---

**Document vivant. Enrichir avec captures écran et workflows précis en S-2.**
