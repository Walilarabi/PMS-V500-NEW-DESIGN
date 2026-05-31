# TODO — Module Facturation Enterprise
**Date :** 2026-05-31 | **Branche :** main
Légende : [ ] à faire · [x] fait · [~] partiel · [!] bloqué

---

## SPRINT 1 — Fondations DB + Repositories

- [x] **T1** — Migrations Supabase (4 tables + 1 vue + ALTER invoices)
  - [x] 20260613_billing_core_tables (ALTER invoices + folios + invoice_lines + invoice_sequences + triggers)
  - [x] 20260613_billing_payments_upgrade (ALTER payments + backfill method)
  - [x] 20260613_billing_house_accounts (house_accounts + house_account_lines + RLS)
  - [x] 20260614_billing_deposits (deposits + RLS)
  - [x] 20260615_billing_credit_notes (credit_notes + next_credit_note_number())
  - [x] 20260616_billing_financial_timeline (VIEW financial_timeline)
  - [x] 20260616_billing_extended_transfers (billing_transfers)

- [x] **T2** — House Accounts repository + 4 hooks
  - [x] src/domains/billing/houseAccounts.repository.ts
  - [x] Extension hooks.ts (useHouseAccounts, useHouseAccountLines, useCreateHouseAccount, useAddHouseAccountLine)

- [x] **T3** — Deposits repository + hooks
  - [x] src/domains/billing/deposits.repository.ts
  - [x] Extension hooks.ts (useDeposits, useCreateDeposit, useCaptureDeposit, useReleaseDeposit, useApplyDepositToInvoice)

- [x] **T4** — Credit Notes repository + hooks
  - [x] src/domains/billing/creditNotes.repository.ts
  - [x] Extension hooks.ts (useCreditNotes, useCreateCreditNote, useIssueCreditNote)

- [x] **T5** — Extended Transfer Service
  - [x] src/domains/billing/transfer.service.ts
  - [x] transferLineToFolio()
  - [x] transferLineToReservation()
  - [x] transferLineToCompany()
  - [x] transferLineToHouseAccount()

### Checkpoint Sprint 1 ✓
- [x] build — clean (no new errors)
- [x] tsc --noEmit — zéro nouvelle erreur
- [x] Repositories + hooks en place

---

## SPRINT 2 — Moteurs purs + Quick win

- [x] **T12** — Pure Engines
  - [x] src/engines/billing/preBillingEngine.ts (8 checks)
  - [x] src/engines/billing/anomalyDetectionEngine.ts (7 anomalies)

- [x] **T16** — RefundModal
  - [x] src/components/billing/RefundModal.tsx
  - [x] Supprimer window.prompt() dans FacturationView.tsx

### Checkpoint Sprint 2 ✓
- [x] Engines purs (aucune dépendance réseau)
- [x] RefundModal raccordé dans InvoicePanel

---

## SPRINT 3 — UI critique (5 composants)

- [x] **T6** — HouseAccountsPanel
  - [x] src/components/billing/HouseAccountsPanel.tsx
  - [x] Onglet "Comptes internes" dans navigation Finance (fin_house_accounts)

- [x] **T7** — DepositsPanel
  - [x] src/components/billing/DepositsPanel.tsx
  - [x] Onglet "Garanties & Acomptes" dans Finance (fin_deposits)

- [x] **T8** — CreditNote UI
  - [x] src/components/billing/CreditNoteModal.tsx
  - [x] src/components/billing/CreditNotesPanel.tsx
  - [x] Section "Avoirs" dans InvoicePanel

- [x] **T13** — PreBillingControlPanel
  - [x] src/components/billing/PreBillingControlPanel.tsx
  - [x] Remplace le bouton "Émettre" direct dans InvoicePanel (8 checks avant émission)

- [x] **T14** — AnomalyDetectionBar
  - [x] src/components/billing/AnomalyDetectionBar.tsx
  - [x] Ajout dans FacturationView (sous KPIs)

### Checkpoint Sprint 3 ✓
- [x] 5 composants rendent sans crash
- [x] tsc --noEmit — zéro nouvelle erreur
- [x] Aucun bouton mort

---

## SPRINT 4 — Transferts avancés + Timeline

- [x] **T9** — AdvancedTransferModal
  - [x] src/components/billing/AdvancedTransferModal.tsx
  - [x] 4 destinations : folio / réservation / société / compte interne
  - [x] Recherche réservation + société debounced (350ms)
  - [x] Raison obligatoire + audit log

- [x] **T10** — FinancialTimelinePanel
  - [x] src/components/billing/FinancialTimelinePanel.tsx
  - [x] Onglet "Timeline financière" dans Finance (fin_timeline)
  - [x] Requête vue financial_timeline Supabase (200 events)
  - [x] Filtrage par type d'événement + recherche texte
  - [x] Export .txt via Blob URL

### Checkpoint Sprint 4 ✓
- [x] AdvancedTransferModal — 4 destinations + recherche debounced
- [x] FinancialTimelinePanel — vrais events depuis VIEW Supabase
- [x] Navigation Finance câblée (types.ts + Sidebar + Topbar + App.tsx)

---

## SPRINT 5 — Features premium

- [x] **T11** — SplitBillingWizard
  - [x] src/components/billing/SplitBillingWizard.tsx
  - [x] Modes : % / montant fixe / auto 50/50
  - [x] Prévisualisation 2 colonnes (steps wizard)
  - [x] Génération 2 vraies factures via createInvoice + addInvoiceLine
  - [x] Bouton "Fractionner" dans InvoicePanel (brouillon avec lignes)

- [x] **T15** — FinancialIntelligencePanel
  - [x] src/components/billing/FinancialIntelligencePanel.tsx
  - [x] Résumé + Métriques clés + Recommandations contextuelles
  - [x] Toggle latéral droit (bouton Brain dans header FacturationView)
  - [x] buildRecommendations() pure function

- [x] **T17** — GroupBillingPanel
  - [x] src/components/billing/GroupBillingPanel.tsx
  - [x] Recherche multi-réservations debounced (350ms)
  - [x] 3 modes : globale / individuelle / mixte
  - [x] Onglet "Facturation groupe" dans Finance (fin_group_billing)

- [x] **T18** — ElectronicSignatureModal
  - [x] src/components/billing/ElectronicSignatureModal.tsx
  - [x] Canvas tactile + souris (SignatureCanvas)
  - [x] UPDATE invoices SET signature_data (dataUrl + signedAt + invoiceNumber)
  - [x] Bouton "Signature" dans InvoicePanel (factures émises)

### Checkpoint Final ✓
- [x] 18 tasks livrées
- [x] tsc --noEmit — zéro nouvelle erreur (erreurs pré-existantes préservées inchangées)
- [x] 0 window.prompt() / window.confirm() dans billing
- [x] 0 donnée hardcodée
- [x] 0 bouton mort
- [x] Audit log écrit pour chaque action critique (SIGN, transfer, reversal)
- [x] RLS sur toutes les tables sensibles
- [x] Navigation Finance complète (4 nouvelles pages)

---

## Commits
- `d6dd5e1` feat(billing): Sprint 1-3 enterprise billing module
- `3e6c861` feat(billing): Sprint 4-5 — transfers, timeline, split, signature, group, intelligence
