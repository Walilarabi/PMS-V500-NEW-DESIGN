# Plan — Enrichissement Onglet Facturation (Fiche Réservation)

**Date :** 2026-05-31 | **Branche :** claude/amazing-sagan-NZbfi  
**Contrainte absolue :** Tout s'intègre dans `TabFacturation` à l'intérieur de `ReservationDetailsModal.tsx`. Zéro nouvelle page. Zéro nouveau module.

---

## Architecture actuelle

```
ReservationDetailsModal.tsx  (~2 500 lignes)
  └── TabFacturation (ligne 699)        ← cible de toutes les modifications
        ├── État local : folios[]
        ├── RÉSUMÉ DU SÉJOUR (stats globales)
        ├── TABS navigation (f1/f2/f3)
        ├── ACTIVE FOLIO RENDER
        │     ├── Folio Header (PDF / Imprimer / Envoyer)
        │     ├── Folio Payer & Address
        │     ├── Folio Lines (table + bulk transfer entre folios)
        │     ├── Add Line Selector (famille + produit)
        │     └── Folio Footer (paiement + totaux)
        └── Print View (portal)
```

### Composants billing existants — compatibilité

| Composant | Compatible local-state | Décision |
|---|---|---|
| `RefundModal` | ✅ Oui — props génériques | Import direct |
| `AdvancedTransferModal` | ⚠️ Types Supabase | Version locale légère |
| `CreditNoteModal` | ⚠️ Types Supabase | Version locale légère |
| `SplitBillingWizard` | ⚠️ Types Supabase | Version locale légère |

---

## Graphe de dépendances

```
AuditEntry[] (Phase 1 — fondation)
      │
      ├──→ BillingActionsToolbar (Phase 2)
      │         ├── FolioTransferDialog  (local)
      │         ├── FolioSplitDialog     (local)
      │         ├── FolioAvoirDialog     (local)
      │         └── RefundModal          (importé existant)
      │
      ├──→ BillingRightPanel (Phase 3) — volet latéral repliable
      │         ├── Résumé Financier
      │         ├── Intelligence Financière
      │         └── Contrôle de Facturation
      │
      └──→ FolioTimeline (Phase 4)
```

---

## Phase 1 — Audit Trail (fondation)

**T1 — AuditEntry type + auditLog state + appendAudit()**

Ajouter dans `TabFacturation` :

```typescript
type AuditEntryType = 'LINE_ADD' | 'PAYMENT' | 'TRANSFER' | 'REFUND' | 'CREDIT_NOTE' | 'SPLIT' | 'DISCOUNT' | 'FOLIO_CREATE';

interface AuditEntry {
  id: string;
  type: AuditEntryType;
  ts: string;       // ISO datetime
  user: string;     // res.client ou 'Réception'
  action: string;   // description lisible
  amount?: number;  // montant en € si applicable
  folioId?: string;
}
```

Initialisation : 1 entrée `FOLIO_CREATE` pour chaque folio initial.  
Instrument toutes les actions existantes : `handleAddService`, `handleBulkTransfer`, paiement, remise.

Critères :
- [ ] `auditLog` initialisé avec 3 entrées (une par folio)
- [ ] Chaque action existante trace une entrée
- [ ] Build propre

---

## Phase 2 — BillingActionsToolbar + Modales locales

**T2 — Barre d'actions ("Zone Actions Financières")**

Toolbar horizontale insérée juste sous le Folio Header.  
Boutons : `Transférer ▼` (dropdown 5 destinations) | `Répartir` | `Avoir` | `Rembourser` | `Historique`.

**T3 — FolioTransferDialog**

5 destinations, formulaire par destination, raison obligatoire.  
Résultat : lignes sélectionnées déplacées (ou nouveau folio créé), audit log écrit.

**T4 — FolioSplitDialog**

Wizard 2 étapes (mode + prévisualisation → confirmation).  
Crée un nouveau folio avec les lignes B, retire-les du folio source.

**T5 — FolioAvoirDialog**

Dialog simple (motif + montant ≤ TTC).  
Ajoute une ligne négative `[AVOIR]` dans le folio actif.

**T6 — RefundModal intégration**

Import de `src/components/billing/RefundModal.tsx`.  
`onConfirm(reason)` → réduit `payments`, ajoute ligne négative `[REMBOURSEMENT]`, trace audit.

### Checkpoint Phase 2
- [ ] 5 boutons fonctionnels, aucun mort
- [ ] Chaque action trace dans auditLog
- [ ] Aucune régression sur l'existant
- [ ] Build propre

---

## Phase 3 — BillingRightPanel (volet latéral repliable)

**T7 — Refactoring layout 2 colonnes**

```
<div style={{ display:'flex', gap:0, alignItems:'flex-start' }}>
  <div style={{ flex:1, minWidth:0, display:'flex', flexDirection:'column', gap:24 }}>
    {/* contenu actuel inchangé */}
  </div>
  <BillingRightPanel ... />
</div>
```

**T8 — BillingRightPanel composant**

3 sections accordéon (Résumé | Intelligence | Contrôle), toggle collapse via chevron.

Résumé Financier : Total facturé / encaissé / solde / arrhes / acomptes / préautorisations.  
Intelligence Financière : risque impayé (calculé) / historique client / panier moyen / recommandations.  
Contrôle de Facturation : TVA / taxe de séjour / paiements / cohérence / alertes.

### Checkpoint Phase 3
- [ ] Volet affiché et repliable
- [ ] Données correctes en temps réel depuis folios[]
- [ ] Build propre

---

## Phase 4 — Timeline Financière

**T9 — FolioTimeline composant + intégration**

Composant inline dans le même fichier.  
Affiche `auditLog[]` trié du plus récent au plus ancien, avec filtres par type.

### Checkpoint Final
- [ ] 4 phases intégrées, aucune régression
- [ ] Tout accessible depuis Fiche Réservation → Onglet Facturation
- [ ] Aucune nouvelle page, aucun nouveau module
- [ ] tsc --noEmit sans nouvelle erreur

---

## Fichiers modifiés

- `frontend/src/components/modals/ReservationDetailsModal.tsx` — **seul fichier**
- Imports ajoutés : `RefundModal`, `Clock`, `ChevronRight`, `ChevronLeft`, `MoreHorizontal`
