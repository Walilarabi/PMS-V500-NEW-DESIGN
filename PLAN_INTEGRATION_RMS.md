# PLAN INTÉGRATION RMS COMPLÈTE

## ARCHITECTURE FINALE

```
Revenue Management System (RMS)
│
├── RMS Tableau Pro (/pages/revenue/RMSTableauPro.tsx)
│   ├── 23 colonnes métier
│   ├── Moteur recommandation intelligent
│   ├── Vue Tableau + Vue Kanban
│   └── Lien vers → Veille Concurrentielle
│
├── Veille Concurrentielle (/pages/revenue/VeilleConcurrentielle.tsx)  
│   ├── Tableau compset temps réel
│   ├── Stats marché (KPI cards)
│   ├── Filtres avancés
│   ├── Historique variations
│   └── Lien vers → RMS Tableau Pro
│
└── Calendrier Tarifaire (/pages/revenue/PricingCalendar.tsx)
    ├── Grille prix existante
    ├── Réception propagation RMS
    └── Lien vers → RMS Tableau Pro
```

## NAVIGATION ENTRE MODULES

### **Header Component** (partagé)
```tsx
<RevenueHeader
  icon={icon}
  title={title}
  subtitle={subtitle}
  quickActions={[
    { label: 'RMS Tableau', onClick: () => navigate('rms') },
    { label: 'Veille Compset', onClick: () => navigate('rev_compset') },
    { label: 'Calendrier', onClick: () => navigate('rev_pricing') }
  ]}
/>
```

### **Workflow Propagation**
```
RMS Validation → Calendrier Tarifaire → Channel Manager → Réservations
```

## COMPOSANTS À CRÉER

1. **RevenueHeader.tsx** : Header unifié avec navigation rapide
2. **KPIStrip.tsx** : Bande KPI réutilisable  
3. **CompsetTable.tsx** : Tableau concurrents standalone
4. **RMSToolbar.tsx** : Toolbar avec filtres/vues
5. **NavigationBreadcrumb.tsx** : Fil d'ariane Revenue

## TODO IMMÉDIAT

- [ ] Refaire VeilleConcurrentielle avec design HTML exact
- [ ] Créer RevenueHeader partagé
- [ ] Ajouter liens navigation dans RMSTableauPro
- [ ] Intégrer KPI cards style HTML
- [ ] Test connectivité complète
