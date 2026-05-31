# TODO — Module Facturation Enterprise
**Date :** 2026-05-31 | **Branche :** main
Légende : [ ] à faire · [x] fait · [~] partiel · [!] bloqué

---

## SPRINT 1 — Fondations DB + Repositories

- [ ] **T1** — Migrations Supabase (4 tables + 1 vue + ALTER invoices)
  - [ ] 20260613_billing_house_accounts.sql (house_accounts + house_account_lines + trigger append-only + RLS)
  - [ ] 20260614_billing_deposits.sql (deposits + RLS)
  - [ ] 20260615_billing_credit_notes.sql (credit_notes + ALTER invoices ADD credit_note_of + ADD signature_data)
  - [ ] 20260616_billing_extended_transfers.sql (Vue financial_timeline)

- [ ] **T2** — House Accounts repository + 4 hooks
  - [ ] src/domains/billing/houseAccounts.repository.ts
  - [ ] Extension src/domains/billing/hooks.ts (useHouseAccounts, useHouseAccountLines, useCreateHouseAccount, useAddHouseAccountLine)

- [ ] **T3** — Deposits repository + hooks
  - [ ] src/domains/billing/deposits.repository.ts
  - [ ] Extension hooks.ts (useDeposits, useCreateDeposit, useCaptureDeposit, useReleaseDeposit, useApplyDepositToInvoice)

- [ ] **T4** — Credit Notes repository + hooks
  - [ ] src/domains/billing/creditNotes.repository.ts
  - [ ] Extension hooks.ts (useCreditNotes, useCreateCreditNote, useIssueCreditNote)

- [ ] **T5** — Extended Transfer Service
  - [ ] transferLineToRoom()
  - [ ] transferLineToReservation()
  - [ ] transferLineToCompany()
  - [ ] transferLineToHouseAccount()

### Checkpoint Sprint 1
- [ ] npm run build — clean
- [ ] npx tsc --noEmit — zéro erreur
- [ ] hooks.test.tsx — toujours verts

---

## SPRINT 2 — Moteurs purs + Quick win

- [ ] **T12** — Pure Engines
  - [ ] src/engines/billing/preBillingEngine.ts (8 checks)
  - [ ] src/engines/billing/anomalyDetectionEngine.ts (7 anomalies)

- [ ] **T16** — RefundModal
  - [ ] src/components/billing/RefundModal.tsx
  - [ ] Supprimer window.prompt() dans FacturationView.tsx

### Checkpoint Sprint 2
- [ ] Engines testés (vitest)
- [ ] RefundModal end-to-end

---

## SPRINT 3 — UI critique (5 composants)

- [ ] **T6** — HouseAccountsPanel
  - [ ] src/components/billing/HouseAccountsPanel.tsx
  - [ ] Onglet "Comptes internes" dans navigation Finance
  - [ ] Bouton "→ Compte interne" dans FoliosView

- [ ] **T7** — DepositsPanel
  - [ ] src/components/billing/DepositsPanel.tsx
  - [ ] Onglet "Garanties & Acomptes" dans Finance

- [ ] **T8** — CreditNote UI
  - [ ] src/components/billing/CreditNoteModal.tsx
  - [ ] src/components/billing/CreditNotesPanel.tsx
  - [ ] Bouton "Créer un avoir" dans InvoicePanel

- [ ] **T13** — PreBillingControlPanel
  - [ ] src/components/billing/PreBillingControlPanel.tsx
  - [ ] Remplace le bouton "Émettre" direct dans InvoicePanel

- [ ] **T14** — AnomalyDetectionBar
  - [ ] src/components/billing/AnomalyDetectionBar.tsx
  - [ ] Ajout dans FacturationView (sous KPIs)

### Checkpoint Sprint 3
- [ ] 5 composants rendent sans crash
- [ ] npx tsc --noEmit — zéro erreur
- [ ] Aucun bouton mort

---

## SPRINT 4 — Transferts avancés + Timeline

- [ ] **T9** — AdvancedTransferModal
  - [ ] src/components/billing/AdvancedTransferModal.tsx
  - [ ] 6 destinations : folio / chambre / résa / société / compte interne
  - [ ] Recherche résa debounced
  - [ ] Raison obligatoire + audit log

- [ ] **T10** — FinancialTimelinePanel
  - [ ] src/components/billing/FinancialTimelinePanel.tsx
  - [ ] Onglet "Timeline" dans Finance
  - [ ] Requête vue financial_timeline Supabase
  - [ ] Filtrage par type d'événement
  - [ ] Export texte

### Checkpoint Sprint 4
- [ ] AdvancedTransferModal — 5 destinations testées
- [ ] FinancialTimelinePanel — vrais events affichés

---

## SPRINT 5 — Features premium

- [ ] **T11** — SplitBillingWizard
  - [ ] src/components/billing/SplitBillingWizard.tsx
  - [ ] Modes : % / montant fixe / règle auto
  - [ ] Prévisualisation 2 colonnes
  - [ ] Génération 2 vraies factures

- [ ] **T15** — FinancialIntelligencePanel
  - [ ] src/components/billing/FinancialIntelligencePanel.tsx
  - [ ] Résumé + Analyse client + Recommandations contextuelles
  - [ ] Toggle latéral droit dans FacturationView

- [ ] **T17** — GroupBillingPanel
  - [ ] src/components/billing/GroupBillingPanel.tsx
  - [ ] Recherche multi-réservations
  - [ ] 3 modes : globale / individuelle / mixte

- [ ] **T18** — ElectronicSignaturePanel
  - [ ] src/components/billing/SignatureCanvas.tsx (canvas tactile)
  - [ ] src/components/billing/ElectronicSignatureModal.tsx
  - [ ] UPDATE invoices SET signature_data

### Checkpoint Final
- [ ] 18 tasks toutes livrées
- [ ] npm run build — clean
- [ ] npx tsc --noEmit — zéro erreur
- [ ] 0 window.prompt() / window.confirm() dans billing
- [ ] 0 donnée hardcodée
- [ ] 0 bouton mort
- [ ] Audit log écrit pour chaque action critique
- [ ] hooks.test.tsx — verts
