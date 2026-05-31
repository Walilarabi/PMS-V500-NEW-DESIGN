# Plan — Module Facturation Enterprise (Flowtym PMS)
**Date :** 2026-05-31 | **Branche :** main

---

## AUDIT PHASE 1 — Ce qui existe

### RÉEL et câblé Supabase

| Composant | Fichier | Lignes |
|-----------|---------|--------|
| Invoices lifecycle (draft→issued→paid→voided) + auto-numérotation F2026-XXXXX | domains/billing/repository.ts | 407 |
| Folios multi-types (guest/company/master/extra) + drag-drop | pages/finance/FoliosView.tsx | 300+ |
| Lignes append-only + corrections via reversal | domains/billing/hooks.ts | 176 |
| Paiements immuables (6 méthodes) + reversals | idem | |
| Transferts folio-to-folio RPC + audit immuable | services/finance/finance.service.ts | |
| E-factures UBL 2.1 → PPF (8 états) | pages/finance/EInvoiceView.tsx | |
| PDF jsPDF | pages/admin/AdminBilling.tsx | |
| KPIs + RLS hotel_id + Audit logs | hooks + migrations | |

### ABSENT — à construire

| Feature | Sprint | Task |
|---------|--------|------|
| House Accounts (Direction/Commercial/etc.) | 1 | T1+T2 |
| Avoirs (credit notes) standalone | 1 | T1+T4 |
| Dépôts / Arrhes / Acomptes / Garanties / Préauth | 1 | T1+T3 |
| Extended Transfer (chambre/résa/société/house account) | 1 | T1+T5 |
| Timeline financière vue Supabase | 1 | T1 |
| Moteur validation pré-facturation (pure fn) | 2 | T12 |
| Moteur détection anomalies (pure fn) | 2 | T12 |
| RefundModal (remplace prompt() natif) | 2 | T16 |
| HouseAccountsPanel (UI) | 3 | T6 |
| DepositsPanel (UI) | 3 | T7 |
| CreditNoteModal + CreditNotesPanel (UI) | 3 | T8 |
| PreBillingControlPanel (UI) | 3 | T13 |
| AnomalyDetectionBar (UI) | 3 | T14 |
| AdvancedTransferModal (UI, 6 destinations) | 4 | T9 |
| FinancialTimelinePanel (UI) | 4 | T10 |
| SplitBillingWizard (UI) | 5 | T11 |
| FinancialIntelligencePanel (sidebar IA) | 5 | T15 |
| GroupBillingPanel (UI) | 5 | T17 |
| ElectronicSignaturePanel (canvas tablette) | 5 | T18 |

### PARTIEL — à améliorer

| Feature | Problème | Fix |
|---------|----------|-----|
| Remboursements | Utilise window.prompt() natif | RefundModal (T16) |
| Société billing | Folio type existe, pas de recherche société dédiée | AdvancedTransferModal (T9) |
| Audit trail | Logs en base, pas de timeline visuelle | FinancialTimelinePanel (T10) |

---

## Architecture

**Décision 1 — Sans rupture :** On ENRICHIT FacturationView/FoliosView/EInvoiceView,
on ne les remplace pas. Nouveaux composants = nouveaux onglets + drawers.

**Décision 2 — DB séparée par feature :** Chaque nouvelle table dans sa propre migration.

**Décision 3 — House Accounts = entité première classe :**
table house_accounts + house_account_lines append-only + vue balance calculée.

**Décision 4 — Avoirs = nouvelle facture négative liée :**
Nouvelle facture avec credit_note_of FK, numérotée AV2026-XXXXX.
Ne modifie JAMAIS la facture origine (immuabilité respectée).

**Décision 5 — Dépôts = table dédiée :**
deposits avec deposit_type (arrhes/acompte/preauth/caution) + machine d'états
(pending→captured→released | applied). Application = écriture payments.

**Décision 6 — Moteurs = pure functions :**
src/engines/billing/ — testables sans Supabase, zéro side effect.

---

## Graphe de dépendances

```
T1 (DB Migrations — 4 tables + 1 vue)
  ├── T2 (House Accounts repo/hooks) → T6 (UI) → T9 (AdvancedTransfer)
  ├── T3 (Deposits repo/hooks) → T7 (UI)
  ├── T4 (Credit Notes repo/hooks) → T8 (UI) → T11 (SplitWizard)
  └── T5 (Extended Transfer Service) → T9 (UI) → T10 (Timeline)

T12 (Pure Engines — indépendant)
  ├── T13 (PreBillingControlPanel)
  └── T14 (AnomalyDetectionBar)

T15 (Intelligence Panel) ← T2 + T3 + T4 + T12
T16 (RefundModal) ← aucune dépendance T1
T17 (GroupBilling) ← T5
T18 (Signature) ← T1 (colonne signature_data)
```

---

## SPRINT 1 — Fondations DB + Repositories (Tasks T1–T5)

### Task T1 : Migrations Supabase

**Fichiers à créer :**
```
supabase/migrations/20260613_billing_house_accounts.sql
supabase/migrations/20260614_billing_deposits.sql
supabase/migrations/20260615_billing_credit_notes.sql
supabase/migrations/20260616_billing_extended_transfers.sql
```

**Schémas clés :**

house_accounts + house_account_lines (append-only, trigger bloquant UPDATE/DELETE)
```sql
house_accounts: id, hotel_id, name, category
  CHECK category IN ('direction','commercial','maintenance',
  'compensation','delogement','offerts','litiges','marketing','other')
  description, is_active bool, created_at, updated_at

house_account_lines: id, hotel_id, house_account_id FK,
  description, amount numeric(14,2),
  direction CHECK IN ('debit','credit'),
  source_invoice_line_id FK invoice_lines(id) nullable,
  transferred_by FK users, reason, created_at
```

deposits:
```sql
id, hotel_id FK, reservation_id FK, invoice_id FK nullable,
deposit_type CHECK IN ('arrhes','acompte','preauth','caution'),
amount numeric(14,2), currency char(3) DEFAULT 'EUR',
method CHECK IN ('cash','card','transfer','cheque','other'),
status CHECK IN ('pending','captured','released','applied'),
reference, notes,
captured_at timestamptz nullable, released_at nullable, applied_at nullable,
created_by FK, created_at
```

credit_notes + extension invoices:
```sql
credit_notes: id, hotel_id, invoice_id FK invoices (facture origine),
  credit_invoice_id FK invoices (facture avoir), credit_type
  CHECK IN ('total','partial','selected'), reason, created_by, created_at

-- Extension invoices (ALTER TABLE) :
ADD COLUMN credit_note_of uuid REFERENCES invoices(id) ON DELETE SET NULL
ADD COLUMN signature_data  text  -- base64 PNG de la signature électronique
ADD COLUMN invoice_prefix  text  DEFAULT 'F' -- 'F' ou 'AV' pour les avoirs
```

Vue financial_timeline:
```sql
CREATE VIEW financial_timeline AS
  SELECT 'invoice_created' AS event_type, 'invoice' AS entity_type,
    id AS entity_id, created_at AS event_at, created_by AS actor_id,
    'Facture créée ' || invoice_number AS label, total_ttc AS amount,
    hotel_id, reservation_id
  FROM invoices
  UNION ALL
  SELECT 'payment_recorded', 'payment', id, created_at, created_by,
    'Paiement ' || method || ' ' || amount || '€', amount, hotel_id,
    (SELECT reservation_id FROM invoices WHERE id = invoice_id LIMIT 1)
  FROM payments WHERE status = 'completed'
  UNION ALL
  SELECT 'line_reversed', 'invoice_line', id, created_at, created_by,
    'Ligne annulée : ' || description, total_ttc, hotel_id,
    (SELECT reservation_id FROM invoices WHERE id = invoice_id LIMIT 1)
  FROM invoice_lines WHERE source = 'reversal'
  UNION ALL
  SELECT 'deposit_recorded', 'deposit', id, created_at, created_by,
    deposit_type || ' ' || amount || '€ (' || status || ')', amount,
    hotel_id, reservation_id
  FROM deposits
  ORDER BY event_at DESC;
```

RLS sur toutes les nouvelles tables (même pattern hotel_id).

**Acceptance criteria :**
- [ ] 4 migrations sans erreur (npx supabase db diff)
- [ ] house_account_lines trigger append-only
- [ ] Vue financial_timeline retourne des lignes
- [ ] Toutes les tables protégées par RLS hotel_id

**Dépendances :** Aucune

---

### Task T2 : House Accounts repository + hooks

**Fichiers :**
- src/domains/billing/houseAccounts.repository.ts (nouveau)
- src/domains/billing/hooks.ts (extension : 4 hooks)

**Repository :**
```typescript
listHouseAccounts(): Promise<HouseAccount[]>
createHouseAccount(input: { name; category; description? }): Promise<HouseAccount>
updateHouseAccount(id, updates): Promise<HouseAccount>
addHouseAccountLine(input: { houseAccountId; description; amount; direction; sourceInvoiceLineId?; reason }): Promise<HouseAccountLine>
listHouseAccountLines(houseAccountId): Promise<HouseAccountLine[]>
```

**Hooks :**
```typescript
useHouseAccounts() — queryKey ['house-accounts']
useHouseAccountLines(id) — queryKey ['house-account-lines', id]
useCreateHouseAccount() — mutation
useAddHouseAccountLine() — mutation, invalide ['house-accounts', 'house-account-lines']
```

**Acceptance criteria :**
- [ ] listHouseAccounts retourne tableau (vide = OK)
- [ ] createHouseAccount insère + invalide cache
- [ ] addHouseAccountLine append-only (Supabase retourne erreur si UPDATE tenté)
- [ ] npx tsc — zéro erreur sur le fichier

**Dépendances :** T1

---

### Task T3 : Deposits repository + hooks

**Fichiers :**
- src/domains/billing/deposits.repository.ts (nouveau)
- src/domains/billing/hooks.ts (extension)

**Repository :**
```typescript
listDeposits(params: { reservationId?: string; invoiceId?: string }): Promise<Deposit[]>
createDeposit(input: { reservationId; depositType; amount; method; reference?; notes? }): Promise<Deposit>
captureDeposit(id): Promise<Deposit>  -- pending → captured
releaseDeposit(id): Promise<Deposit>  -- captured → released
applyDepositToInvoice(depositId, invoiceId): Promise<{ deposit: Deposit; payment: PaymentRow }>
```

**Logique applyDepositToInvoice :**
1. UPDATE deposits SET status='applied', applied_at=now(), invoice_id=invoiceId
2. INSERT INTO payments (invoiceId, amount, method='other', reference='Dépôt appliqué', status='completed')
3. Audit log 'deposit_applied'
4. Invalider ['deposits', 'payments', 'invoices']

**Acceptance criteria :**
- [ ] Machine d'états respectée (pending→captured, captured→released/applied)
- [ ] applyDeposit crée un vrai paiement visible dans la liste paiements
- [ ] Transitions invalides levées comme erreur

**Dépendances :** T1

---

### Task T4 : Credit Notes repository + hooks

**Fichiers :**
- src/domains/billing/creditNotes.repository.ts (nouveau)
- src/domains/billing/hooks.ts (extension)

**Repository :**
```typescript
createCreditNote(invoiceId, type: 'total'|'partial'|'selected', lineIds?: string[], reason: string)
  : Promise<{ creditNote: CreditNote; creditInvoice: InvoiceRow }>
listCreditNotes(invoiceId): Promise<CreditNote[]>
issueCreditNote(creditNoteId): Promise<void>
```

**Logique createCreditNote :**
1. Lire toutes les lignes de la facture origine (ou seulement lineIds si partiel)
2. Générer numéro "AV" via next_invoice_number() MAIS avec préfixe AV
   → Soit séquence dédiée AV, soit préfixe sur même séquence (option : colonne invoice_prefix)
3. Créer nouvelle facture avec credit_note_of = invoiceId
4. Copier les lignes avec quantity × (-1) et source='reversal'
5. Créer entrée credit_notes avec credit_invoice_id = nouvelle facture
6. Retourner { creditNote, creditInvoice }

**Acceptance criteria :**
- [ ] Avoir total = somme négative de toutes les lignes originales
- [ ] Avoir partiel = seulement les lignes sélectionnées
- [ ] N° avoir commence par AV (ex: AV2026-00001)
- [ ] credit_note_of FK bien renseigné

**Dépendances :** T1

---

### Task T5 : Extended Transfer Service

**Fichiers :**
- src/services/finance/finance.service.ts (extensions)

**Nouvelles fonctions :**
```typescript
transferLineToRoom(lineId, targetRoomRef, reason): Promise<TransferResult>
  -- Crée reversal sur facture source
  -- Cherche/crée facture pour la chambre cible
  -- Crée la ligne sur la facture cible
  -- Audit log avec source + cible

transferLineToReservation(lineId, targetReservationId, reason): Promise<TransferResult>
  -- Même logique que transferToRoom mais cible = reservation_id

transferLineToCompany(lineId, companyName, companyVat, reason): Promise<TransferResult>
  -- Crée/sélectionne un folio company sur la même facture
  -- Déplace la ligne dans ce folio
  -- Snapshot bill_to_name/bill_to_vat

transferLineToHouseAccount(lineId, houseAccountId, reason): Promise<TransferResult>
  -- Crée reversal sur facture source
  -- Crée house_account_line dans le compte cible
  -- Audit log complet
```

**interface TransferResult :**
```typescript
{
  sourceLineId: string;  // la ligne originale
  reversalLineId: string; // la reversal créée
  targetLineId: string | null; // nouvelle ligne (null pour house account)
  targetHouseAccountLineId: string | null;
  auditLogId: string;
}
```

**Acceptance criteria :**
- [ ] Chaque transfert crée une reversal + une nouvelle ligne (ou house_account_line)
- [ ] Audit log écrit pour chaque transfert
- [ ] Montant source = montant cible (pas de perte)
- [ ] npx tsc — zéro erreur

**Dépendances :** T1, T2

---

### Checkpoint Sprint 1
- [ ] npm run build — clean
- [ ] npx tsc --noEmit — zéro erreur dans les 5 nouveaux fichiers
- [ ] hooks.test.tsx — toujours verts

---

## SPRINT 2 — Moteurs purs + Quick win

### Task T12 : Pure Engines (preBillingEngine + anomalyDetectionEngine)

**Fichiers à créer :**
- src/engines/billing/preBillingEngine.ts
- src/engines/billing/anomalyDetectionEngine.ts

**preBillingEngine.ts — Types :**
```typescript
interface PreBillingCheck {
  id: string;
  label: string;
  status: 'pass' | 'fail' | 'warning';
  detail?: string;
  fixHint?: string;
}

function runPreBillingChecks(params: {
  invoice: InvoiceRow;
  lines: InvoiceLineRow[];
  payments: PaymentRow[];
  reservation?: { pension_type?: string; check_out?: string; nights?: number };
  legalMentions?: boolean;
}): PreBillingCheck[]
```

**Checks implémentés (8) :**
1. TVA_VALID — tva_rate IN [0, 2.1, 5.5, 10, 20] pour chaque ligne
2. TAXE_SEJOUR — si nights > 0, au moins 1 ligne avec description contenant "taxe" ou "séjour"
3. PRODUCTS_DESCRIBED — aucune ligne avec description vide ou < 3 chars
4. BALANCE_ZERO — si status='issued', balance attendue = 0 (paiements couvrent le total)
5. BILL_TO_NAME — bill_to_name non vide
6. BILL_TO_ADDRESS — bill_to_address non vide
7. NO_DUPLICATE — pas 2 lignes avec même (description, service_date, unit_price_ht)
8. LEGAL_MENTIONS — legalMentions param = true

**anomalyDetectionEngine.ts — Types :**
```typescript
interface BillingAnomaly {
  type: string;
  severity: 'error' | 'warning' | 'info';
  message: string;
  lineId?: string;
  fixHint: string;
}

function detectAnomalies(params: {
  invoice: InvoiceRow;
  lines: InvoiceLineRow[];
  payments: PaymentRow[];
  reservation?: { pension_type?: string; check_out?: string; nights?: number };
}): BillingAnomaly[]
```

**Anomalies détectées (7) :**
1. MISSING_BREAKFAST — pension BB/HB/FB sans ligne "petit-déjeuner"
2. MISSING_TAXE_SEJOUR — hébergement sans taxe séjour (search "TAXE" in product_code)
3. ZERO_VAT_PRODUCT — ligne tva_rate=0 sans product_code exempté (EXEMPT/TVA0)
4. OVERPAYMENT — paid_amount > total_ttc + 0.01
5. NEGATIVE_BALANCE — balance < -0.01 (trop-perçu)
6. DUPLICATE_LINE — 2 lignes (same description + same service_date + same amount)
7. STALE_ISSUED — status='issued' + issued_at < now() - 30 days + paid_amount = 0

**Acceptance criteria :**
- [ ] runPreBillingChecks retourne [] pour facture propre
- [ ] detectAnomalies retourne [] pour séjour sans anomalie
- [ ] Chaque check/anomalie retourne un fixHint non vide
- [ ] Aucun import Supabase dans ces fichiers (pure functions)

---

### Task T16 : RefundModal

**Fichier :** src/components/billing/RefundModal.tsx (nouveau)
**Modification :** src/pages/finance/FacturationView.tsx (remplacer prompt())

**UI RefundModal :**
- Prop: payment: PaymentRow, invoiceId: string, onClose: () => void
- Header : "Rembourser le paiement"
- Affichage montant original : "Paiement de 350,00 € encaissé le XX/XX par CB"
- Input "Montant à rembourser" (défaut = montant original, max = montant original)
- Select "Motif" : Annulation réservation / Erreur de facturation / Geste commercial / Autre
- Textarea "Détail" (visible si motif = Autre)
- Select "Mode de remboursement" : CB / Espèces / Virement / Chèque
- Bouton "Confirmer le remboursement" (violet, disabled si montant vide ou motif vide)
- Bouton "Annuler" (ghost)
- En cas d'erreur : message rouge inline

**Acceptance criteria :**
- [ ] Plus aucun window.prompt() dans FacturationView
- [ ] Le modal s'ouvre au clic sur le bouton remboursement RotateCcw
- [ ] La confirmation appelle reversePayment.mutate({ paymentId, invoiceId, reason: motif + détail })
- [ ] En cas d'erreur Supabase, message d'erreur visible dans le modal

---

### Checkpoint Sprint 2
- [ ] Engines testés (vitest, pas de Supabase)
- [ ] RefundModal end-to-end (click → modal → confirm → toast)

---

## SPRINT 3 — UI critique (5 composants)

### Task T6 : HouseAccountsPanel

**Fichier :** src/components/billing/HouseAccountsPanel.tsx

**UI :**
- Header : "Comptes internes" + bouton "+ Nouveau compte"
- Grille des comptes (cards) : nom + catégorie badge coloré + solde coloré
- Solde vert si ≥ 0, rouge si < 0
- Catégories avec icônes : Direction(Crown), Commercial(TrendingUp), Maintenance(Wrench)…
- Clic sur compte → drawer droit avec historique des mouvements
- Drawer : liste des lignes (date, description, montant débit/crédit, source)
- Bouton "+ Transfert manuel" dans le drawer → modal simple (description + montant + sens)
- Formulaire création : nom, catégorie (select), description (textarea)

**Intégration :**
- Onglet "Comptes internes" dans la navigation du module Finance
- Bouton "→ Compte interne" dans le menu actions de chaque ligne de folio (FoliosView)

**Acceptance criteria :**
- [ ] Liste depuis Supabase (useHouseAccounts)
- [ ] Création persiste (useCreateHouseAccount + invalidation)
- [ ] Historique filtré par house_account_id (useHouseAccountLines)
- [ ] Solde calculé depuis house_account_lines (pas hardcodé)
- [ ] Aucun bouton mort

---

### Task T7 : DepositsPanel

**Fichier :** src/components/billing/DepositsPanel.tsx

**UI :**
- KPI strip : Montant autorisé total / Capturé / Disponible (total - capturé - appliqué)
- Tableau : type | montant | méthode | statut (badge) | date | actions
- Badge statut : pending=orange, captured=bleu, released=gris, applied=vert
- Bouton "+ Enregistrer un dépôt" → modal (type, montant, méthode, référence, notes)
- Actions par ligne :
  - Si pending : "Capturer" button (bleu) + "Annuler"
  - Si captured : "Libérer" button (gris) + "Appliquer sur facture" (vert)
  - Si released/applied : lecture seule
- "Appliquer sur facture" → select de la facture cible (si plusieurs)
- Timeline hover : tooltip avec historique du dépôt (créé, capturé, libéré, appliqué)

**Acceptance criteria :**
- [ ] createDeposit persiste en Supabase
- [ ] Transitions d'état fonctionnent (captureDeposit, releaseDeposit, applyDeposit)
- [ ] applyDeposit crée un paiement visible dans la liste paiements de la facture
- [ ] KPIs calculés depuis les vraies données

---

### Task T8 : CreditNoteModal + CreditNotesPanel

**Fichiers :**
- src/components/billing/CreditNoteModal.tsx
- src/components/billing/CreditNotesPanel.tsx

**CreditNoteModal :**
- Trigger : bouton "Créer un avoir" sur InvoicePanel (factures issued/paid)
- Header : "Avoir — Facture [N°]"
- 3 onglets :
  * Total : aperçu montant négatif, champ raison obligatoire
  * Partiel : liste checkboxes des lignes + total calculé en temps réel
  * Sur sélection : idem partiel + champ quantité par ligne
- Bouton "Générer l'avoir" → createCreditNote() → toast "Avoir AV2026-XXXXX créé"

**CreditNotesPanel :**
- Section "Avoirs liés" en bas de InvoicePanel
- Tableau : n° avoir | type | montant | statut | date
- Bouton "Émettre" si statut=draft
- Lien cliquable "Voir" → ouvre la facture avoir

**Acceptance criteria :**
- [ ] Bouton "Créer un avoir" visible sur invoices issued/paid
- [ ] Avoir total = somme négative de toutes les lignes
- [ ] N° avoir format AV2026-XXXXX
- [ ] Avoir visible dans liste factures avec badge "Avoir" distinct

---

### Task T13 : PreBillingControlPanel

**Fichier :** src/components/billing/PreBillingControlPanel.tsx

**UI :**
- S'affiche quand on clique "Émettre la facture" (AVANT l'action réelle)
- Header : "Contrôle avant émission" + X pour fermer
- Loader pendant runPreBillingChecks()
- Liste des checks : icône + label + statut + détail expandable
  - ✓ vert : "TVA valide sur toutes les lignes"
  - ✗ rouge : "Adresse de facturation manquante" + "→ Corriger"
  - ⚠ orange : "Taxe de séjour non détectée" + "→ Ajouter"
- Footer :
  - Si tout pass : "✓ Contrôle validé — Émettre la facture" (violet)
  - Si warning : "Émettre malgré les avertissements" (ambre)
  - Si error : "Corriger les anomalies avant émission" (grisé) + lien corrections
  - Option admin : "Forcer l'émission (admin)" avec double confirmation

**Acceptance criteria :**
- [ ] Le bouton "Émettre" dans InvoicePanel ouvre ce panel en premier
- [ ] runPreBillingChecks appelé avec données réelles depuis Supabase
- [ ] L'émission réelle (issueInvoice.mutate) n'a lieu qu'après validation
- [ ] Aucune régression sur le flux d'émission normal

---

### Task T14 : AnomalyDetectionBar

**Fichier :** src/components/billing/AnomalyDetectionBar.tsx

**UI :**
- Bande orange dismissable entre les KPIs et la liste des factures
- Structure : AlertTriangle icon + "X anomalie(s) détectée(s)" + bouton Détails + bouton ✕
- Expandable : liste des anomalies avec description + fixHint + bouton "Corriger"
- Invisible si detectAnomalies retourne []
- Recalcul auto via useMemo sur lines + payments

**Props :** invoice: InvoiceRow | null, lines: InvoiceLineRow[], payments: PaymentRow[], reservation?: ...

**Acceptance criteria :**
- [ ] detectAnomalies appelé avec vraies données
- [ ] Bande visible si anomalies, invisible sinon
- [ ] Bouton dismiss = localStorage flag (dismissed par facture ID)
- [ ] Re-apparaît si une nouvelle anomalie est détectée

---

### Checkpoint Sprint 3
- [ ] 5 composants rendent sans crash
- [ ] npx tsc --noEmit — zéro erreur
- [ ] Aucun bouton mort (test manuel chaque bouton)
- [ ] Aucune donnée hardcodée dans les 5 composants

---

## SPRINT 4 — Transferts avancés + Timeline

### Task T9 : AdvancedTransferModal

**Fichier :** src/components/billing/AdvancedTransferModal.tsx

**Props :** lines: InvoiceLineRow[], invoiceId: string, onClose: () => void, onSuccess: () => void

**UI — Étape 1 : Sélection des lignes**
- Checkboxes sur chaque ligne avec montant
- "Tout sélectionner" toggle
- Total sélectionné en bas

**UI — Étape 2 : Destination**
```
Transférer vers :
○ Folio              [select: Principal / Hébergement / Bar / …]
○ Chambre            [input search: "101" → autocomplete]
○ Réservation        [search: nom / email / n° résa → debounced]
○ Société            [input: nom + TVA]
○ Compte interne     [select: Direction / Commercial / …]
```

**UI — Étape 3 : Confirmation**
- Résumé : "3 lignes · 350,00 € TTC → Compte interne: Direction"
- Input "Raison du transfert" (obligatoire)
- Bouton "Confirmer" (violet)
- Loader pendant la mutation
- Toast + fermeture au succès

**Acceptance criteria :**
- [ ] Folio → transferPrestationFolio() (existant)
- [ ] Chambre → transferLineToRoom()
- [ ] Réservation → transferLineToReservation()
- [ ] Société → transferLineToCompany()
- [ ] Compte interne → transferLineToHouseAccount()
- [ ] Chaque transfert a un audit log avec raison
- [ ] Recherche réservation retourne vraies réservations

---

### Task T10 : FinancialTimelinePanel

**Fichier :** src/components/billing/FinancialTimelinePanel.tsx

**Données :** Vue financial_timeline requêtée via useQuery (queryKey ['financial-timeline', invoiceId])

**UI :**
- Timeline verticale (ligne + points colorés)
- Point coloré par type : vert=paiement, violet=facture, bleu=transfert, orange=avoir, rouge=annulation
- Chaque événement :
  - Icône (FileText/CreditCard/ArrowLeftRight/RotateCcw)
  - Date + heure formatés FR
  - Utilisateur (avatar initiales ou "Système")
  - Label (ex: "Paiement CB 350,00 €")
  - Montant en badge (coloré vert/rouge selon positif/négatif)
- Filtrage par type d'événement (tous / factures / paiements / transferts)
- Bouton "Exporter" → génère liste texte copiable

**Acceptance criteria :**
- [ ] Vue financial_timeline requêtée depuis Supabase
- [ ] Zéro donnée hardcodée
- [ ] Filtrage fonctionne
- [ ] "Système" affiché si actor_id est null

---

### Checkpoint Sprint 4
- [ ] AdvancedTransferModal — 5 destinations testées manuellement
- [ ] FinancialTimelinePanel — vrais events affichés
- [ ] Audit log écrit pour chaque transfert

---

## SPRINT 5 — Features premium

### Task T11 : SplitBillingWizard

**Fichier :** src/components/billing/SplitBillingWizard.tsx

**Étapes :**
1. Sélection des lignes (checkboxes + tout sélectionner)
2. Mode de répartition :
   - Pourcentage : radio (50/50, 70/30, 80/20, Personnalisé → 2 sliders)
   - Montant fixe : input "Part 1" + "Part 2 = total - Part 1"
   - Règle auto : select (Hébergement→Société/Extras→Client, Toutes→Société)
3. Prévisualisation : 2 colonnes côte à côte, totaux en bas, "Σ = total original" vérification
4. Destinataires : Facture 1 (client existant) + Facture 2 (saisir nom société/adresse)
5. Génération : createInvoice × 2 + addInvoiceLine × N → "Deux factures créées"

**Acceptance criteria :**
- [ ] sum(facture1.total_ttc, facture2.total_ttc) === invoice.total_ttc
- [ ] 2 vraies factures créées en Supabase (draft)
- [ ] Règle auto fonctionne sur product_code ou description contains

---

### Task T15 : FinancialIntelligencePanel

**Fichier :** src/components/billing/FinancialIntelligencePanel.tsx

**Intégration :** Volet latéral droit (240px), toggle via bouton dans FacturationView header.

**Sections :**

1. Résumé financier du séjour :
   - Total facturé TTC / Total encaissé / Reste à encaisser
   - Graphe simple (barre de progression encaissé/total)
   - Statut résumé : "Soldé ✓" ou "⚠ 150€ restants"

2. Analyse client :
   - N° séjours (depuis reservations table)
   - Panier moyen des séjours précédents
   - Indicateur risque (vert/orange/rouge) basé sur % d'impayés historiques

3. Recommandations contextuelles (max 3) :
   - Check-out dans < 24h ET solde > 0 → "Encaisser {solde} avant départ"
   - pension BB/HB ET pas de ligne petit-déj → "Ajouter prestation Petit-déjeuner"
   - Avoir en draft → "Émettre l'avoir {n°}"
   - Dépôt captured non appliqué → "Appliquer l'acompte de {montant}"
   - Chaque recommandation = bouton d'action direct

**Acceptance criteria :**
- [ ] Toutes les métriques depuis Supabase (0 hardcodings)
- [ ] Recommandations basées sur état réel (pas de cas fictifs)
- [ ] Chaque bouton d'action fonctionne (pas mort)
- [ ] Panel s'ouvre/ferme sans casser le layout

---

### Task T17 : GroupBillingPanel

**Fichier :** src/components/billing/GroupBillingPanel.tsx

**UI :**
- Recherche de réservations (debounced, searchFolioReservations)
- Sélection multiple de réservations (checkboxes)
- Vue consolidée : tableau chambres + montants folios + totaux
- Options :
  * Facturation globale (1 facture mère agrégeant tout)
  * Individuelle (N factures séparées — 1 par chambre)
  * Mixte (hébergement→société, extras→individuel)
- Bouton "Générer les factures" → creates invoices + lines
- Résultats : liens vers les factures créées

**Acceptance criteria :**
- [ ] Recherche réservations depuis Supabase
- [ ] Facturation globale → 1 seule facture avec toutes les lignes
- [ ] Facturation individuelle → N factures séparées
- [ ] Aucune ligne perdue (somme totale conservée)

---

### Task T18 : ElectronicSignaturePanel

**Fichiers :**
- src/components/billing/SignatureCanvas.tsx
- src/components/billing/ElectronicSignatureModal.tsx

**SignatureCanvas.tsx :**
- canvas HTML5 avec ref
- Touch events (onTouchStart, onTouchMove, onTouchEnd) + Mouse events
- Dessin ligne continue (ctx.lineTo)
- Prop onChange(dataUrl: string) appelé au onTouchEnd/mouseUp
- Couleur stylo : noir, épaisseur 2px
- Border radius visible, fond blanc

**ElectronicSignatureModal.tsx :**
- Header : "Signature électronique — Facture [N°]"
- Sous-titre : "Signez dans la zone ci-dessous avec votre doigt ou stylet"
- SignatureCanvas 100% largeur, 200px hauteur
- Boutons : "Effacer" (ghost) + "Valider la signature" (violet, disabled si canvas vide)
- Au clic Valider : UPDATE invoices SET signature_data = dataUrl WHERE id = invoiceId
- Après save : affichage "Signé le [date] par [bill_to_name]" sous le n° de facture

**Acceptance criteria :**
- [ ] Canvas réactif tactile (test tablette ou DevTools mobile)
- [ ] Bouton "Effacer" vide le canvas
- [ ] Signature sauvegardée en Supabase (UPDATE invoices)
- [ ] Affichage "Signé" visible après sauvegarde

---

### Checkpoint Final
- [ ] 18 tasks toutes livrées
- [ ] npm run build — clean (zéro erreur)
- [ ] npx tsc --noEmit — zéro erreur
- [ ] Aucun window.prompt() ou window.confirm() dans le module billing
- [ ] Aucune donnée hardcodée / fake
- [ ] Aucun bouton mort (test manuel chaque bouton)
- [ ] Audit log écrit pour chaque action critique
- [ ] hooks.test.tsx — toujours verts

---

## Fichiers critiques à NE PAS casser

```
frontend/src/pages/finance/FacturationView.tsx         (530 lignes — UI existante)
frontend/src/pages/finance/FoliosView.tsx              (300+ lignes — UI existante)
frontend/src/pages/finance/EInvoiceView.tsx            (UI existante)
frontend/src/domains/billing/hooks.ts                  (176 lignes — hooks existants)
frontend/src/domains/billing/repository.ts             (407 lignes — repo existant)
frontend/src/domains/billing/schemas.ts                (schémas Zod)
frontend/supabase/migrations/0080_billing.sql          (schema de base)
frontend/src/domains/billing/hooks.test.tsx            (tests existants)
```
