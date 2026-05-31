# TODO — Onglet Facturation (Fiche Réservation)
**Date :** 2026-05-31 | **Branche :** claude/amazing-sagan-NZbfi
Légende : [ ] à faire · [x] fait · [~] partiel · [!] bloqué

---

## PHASE 1 — Audit Trail (fondation)

- [ ] **T1** — AuditEntry type + auditLog[] state + appendAudit() dans TabFacturation
  - [ ] Type AuditEntry défini (id, type, ts, user, action, amount?, folioId?)
  - [ ] auditLog initialisé avec 3 entrées FOLIO_CREATE
  - [ ] handleAddService → appendAudit('LINE_ADD', ...)
  - [ ] handleBulkTransfer → appendAudit('TRANSFER', ...)
  - [ ] Paiement validé → appendAudit('PAYMENT', ...)
  - [ ] Remise → appendAudit('DISCOUNT', ...)

### Checkpoint Phase 1
- [ ] build propre
- [ ] auditLog trace toutes les actions existantes

---

## PHASE 2 — BillingActionsToolbar

- [ ] **T2** — Toolbar "Zone Actions Financières" (5 boutons)
  - [ ] Transférer ▼ (dropdown 5 destinations)
  - [ ] Répartir
  - [ ] Créer un avoir
  - [ ] Rembourser
  - [ ] Historique

- [ ] **T3** — FolioTransferDialog (modal locale — 5 destinations)
  - [ ] → Autre chambre
  - [ ] → Autre réservation
  - [ ] → Société (crée folio Société si inexistant)
  - [ ] → Groupe (crée folio Groupe si inexistant)
  - [ ] → Compte interne (log audit seulement)
  - [ ] Raison obligatoire
  - [ ] appendAudit('TRANSFER', ...)

- [ ] **T4** — FolioSplitDialog (wizard local)
  - [ ] Mode 50/50 auto
  - [ ] Mode % configurable
  - [ ] Mode montant fixe
  - [ ] Prévisualisation 2 colonnes
  - [ ] Confirmer → nouveau folio créé dans tabs
  - [ ] appendAudit('SPLIT', ...)

- [ ] **T5** — FolioAvoirDialog (modal locale)
  - [ ] Motif obligatoire
  - [ ] Montant ≤ total TTC du folio actif
  - [ ] Ligne [AVOIR] négative créée
  - [ ] appendAudit('CREDIT_NOTE', ...)

- [ ] **T6** — RefundModal intégration (composant existant importé)
  - [ ] Import RefundModal
  - [ ] paymentAmount = payments du folio actif
  - [ ] onConfirm(reason) → réduit payments + ligne [REMBOURSEMENT]
  - [ ] appendAudit('REFUND', ...)

### Checkpoint Phase 2
- [ ] 5 boutons tous fonctionnels
- [ ] Aucun bouton mort
- [ ] Aucune régression existant
- [ ] build propre

---

## PHASE 3 — BillingRightPanel (volet latéral repliable)

- [ ] **T7** — Layout 2 colonnes dans TabFacturation
  - [ ] Wrapper principal : flex row
  - [ ] Colonne principale : flex:1, minWidth:0
  - [ ] Colonne droite : BillingRightPanel

- [ ] **T8** — BillingRightPanel composant (même fichier)
  - [ ] Toggle collapse/expand (chevron)
  - [ ] Section Résumé Financier
    - [ ] Total facturé, encaissé, solde
    - [ ] Arrhes, acomptes, préautorisations
  - [ ] Section Intelligence Financière
    - [ ] Risque impayé (badge couleur calculé)
    - [ ] Historique client (nb séjours)
    - [ ] Panier moyen (TTC / nuits)
    - [ ] Recommandations contextuelles
  - [ ] Section Contrôle de Facturation
    - [ ] TVA présente ✅/❌
    - [ ] Taxe de séjour ✅/❌
    - [ ] Paiements vérifiés ✅/❌
    - [ ] Facture cohérente ✅/❌
    - [ ] Alertes détectées (count)

### Checkpoint Phase 3
- [ ] Volet repliable fonctionnel
- [ ] Données temps réel depuis folios[]
- [ ] Design cohérent Flowtym
- [ ] build propre

---

## PHASE 4 — Timeline Financière

- [ ] **T9** — FolioTimeline composant (même fichier) + section dans TabFacturation
  - [ ] Affiche auditLog[] trié récent → ancien
  - [ ] Point de couleur par type
  - [ ] date | heure | user | action | montant
  - [ ] Filtres par type (boutons toggle)
  - [ ] Insertion dans TabFacturation sous le folio actif (hors print)

### Checkpoint Final
- [ ] Timeline affiche toutes les entrées d'audit
- [ ] Tout est accessible depuis Fiche Réservation → Onglet Facturation
- [ ] Zéro nouvelle page, zéro nouveau module
- [ ] tsc --noEmit sans nouvelle erreur (hors erreurs pré-existantes)
