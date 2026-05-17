# 🚀 FLOWTYM RMS — ROADMAP AMÉLIORATIONS ENTERPRISE

**Date** : 17 Mai 2026  
**Status** : Spécifications détaillées  
**Complexité estimée** : ~2000 lignes de code supplémentaires  

---

## 📋 VUE D'ENSEMBLE

Le module RMS actuel (706 lignes) doit évoluer vers un outil **enterprise-grade** utilisé par les grandes chaînes hôtelières. Voici les 7 améliorations majeures à implémenter.

---

## 1️⃣ CODES COULEUR PASTEL PREMIUM (MIN/MAX/MEDIAN)

### **Objectif**
Identification visuelle immédiate des tarifs concurrents avec couleurs sobres et professionnelles.

### **Implémentation**

**Calcul MIN/MAX/MEDIAN par date** :
```typescript
// Dans compsetRows, ajouter :
const dailyStats = useMemo(() => {
  const stats = new Map<string, { min: number; max: number; median: number }>();
  
  dateColumns.forEach((col) => {
    const prices = compsetRows
      .map((row) => row.pricing.get(col.date)?.price)
      .filter((p) => p !== undefined) as number[];
    
    if (prices.length > 0) {
      stats.set(col.date, {
        min: Math.min(...prices),
        max: Math.max(...prices),
        median: prices.sort((a, b) => a - b)[Math.floor(prices.length / 2)],
      });
    }
  });
  
  return stats;
}, [compsetRows, dateColumns]);
```

**Styles couleur pastel** :
```typescript
const getPriceColorClass = (price: number, dateStats: { min: number; max: number; median: number }) => {
  if (price === dateStats.min) return 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200';
  if (price === dateStats.max) return 'bg-red-50 text-red-700 ring-1 ring-red-200';
  if (Math.abs(price - dateStats.median) < 5) return 'bg-orange-50 text-orange-700 ring-1 ring-orange-200';
  return 'bg-white text-gray-800';
};
```

**Application dans le render** :
```tsx
<span className={cn(
  'text-sm font-bold px-2 py-1 rounded',
  getPriceColorClass(priceData.price, dailyStats.get(col.date)!)
)}>
  {priceData.price.toFixed(0)}€
</span>
```

### **Résultat attendu**
- Prix MIN : fond vert pastel `#ECFDF5` avec texte `#047857`
- Prix MAX : fond rouge pastel `#FEF2F2` avec texte `#B91C1C`
- Prix MEDIAN : fond orange pastel `#FFF7ED` avec texte `#C2410C`
- Ring subtil 1px pour délimitation

---

## 2️⃣ SECOND TABLEAU — VALIDATION JOUR PAR JOUR

### **Objectif**
Tableau reprenant EXACTEMENT le même design que le compset, pour valider/refuser les recommandations RMS par date.

### **Structure**

**Nouveau composant** `ValidationTable` :
```tsx
<div className="border-b-2 border-gray-300">
  {/* Header */}
  <div style={{ display: 'grid', gridTemplateColumns: gridTemplate }} className="sticky top-0 z-30 bg-white border-b border-gray-200">
    <div className="sticky left-0 z-40 bg-white border-r border-gray-300 flex items-center px-3 py-2" style={{ width: LABEL_W }}>
      <Sparkles className="w-4 h-4 text-violet-500 mr-2" />
      <span className="text-sm font-bold text-gray-800">Recommandations RMS</span>
    </div>
    
    {dateColumns.map((col) => (
      <div key={col.date} className={cn('flex items-center justify-center border-r border-gray-200 py-2', col.isWeekend && 'bg-gray-50')}>
        <span className="text-[10px] font-semibold text-gray-500">Action</span>
      </div>
    ))}
  </div>

  {/* Rows par métrique */}
  <ValidationRow label="Prix actuel" type="current" />
  <ValidationRow label="Prix suggéré" type="recommended" />
  <ValidationRow label="Médiane compset" type="median" />
  <ValidationRow label="Disponibilité" type="availability" />
  <ValidationRow label="Validation" type="action" />
</div>
```

**Ligne Validation avec choix** :
```tsx
{dateColumns.map((col) => {
  const validation = validations.get(col.date);
  
  return (
    <div key={col.date} className="flex flex-col items-center justify-center border-r border-gray-200 py-2 gap-1">
      {/* Boutons de choix */}
      <div className="flex items-center gap-1">
        <button
          onClick={() => handleValidationChoice(col.date, 'OK')}
          className={cn(
            'px-2 py-1 text-[10px] font-semibold rounded border transition-colors',
            validation?.choice === 'OK'
              ? 'bg-emerald-500 text-white border-emerald-500'
              : 'bg-white text-gray-700 border-gray-300 hover:border-emerald-500'
          )}
        >
          OK
        </button>
        
        <button
          onClick={() => handleValidationChoice(col.date, 'NON')}
          className={cn(
            'px-2 py-1 text-[10px] font-semibold rounded border transition-colors',
            validation?.choice === 'NON'
              ? 'bg-red-500 text-white border-red-500'
              : 'bg-white text-gray-700 border-gray-300 hover:border-red-500'
          )}
        >
          NON
        </button>
        
        <button
          onClick={() => handleValidationChoice(col.date, 'MAINTENIR')}
          className={cn(
            'px-2 py-1 text-[10px] font-semibold rounded border transition-colors',
            validation?.choice === 'MAINTENIR'
              ? 'bg-blue-500 text-white border-blue-500'
              : 'bg-white text-gray-700 border-gray-300 hover:border-blue-500'
          )}
        >
          Maintenir
        </button>
      </div>
      
      {/* Input éditable si NON */}
      {validation?.choice === 'NON' && (
        <input
          type="number"
          value={validation.manualPrice || ''}
          onChange={(e) => handleManualPriceChange(col.date, Number(e.target.value))}
          className="w-16 px-2 py-1 text-xs text-center border border-violet-500 rounded focus:outline-none focus:ring-2 focus:ring-violet-500"
          placeholder="Prix"
        />
      )}
    </div>
  );
})}
```

### **Handlers**
```typescript
const handleValidationChoice = (date: string, choice: ValidationChoice) => {
  setValidations((prev) => {
    const newMap = new Map(prev);
    const recommendation = recommendations.find((r) => r.date === date);
    
    newMap.set(date, {
      date,
      choice,
      manualPrice: choice === 'NON' ? (prev.get(date)?.manualPrice || null) : null,
      recommendation,
    });
    
    return newMap;
  });
};

const handleManualPriceChange = (date: string, price: number) => {
  setValidations((prev) => {
    const newMap = new Map(prev);
    const current = newMap.get(date);
    
    if (current) {
      newMap.set(date, { ...current, manualPrice: price });
    }
    
    return newMap;
  });
};
```

---

## 3️⃣ MODE AUTOMATIQUE INTELLIGENT

### **Objectif**
Switch global activant l'application automatique des recommandations selon des règles définies.

### **UI Switch**

**Dans toolbar** :
```tsx
<div className="flex items-center gap-2 pl-2 border-l border-gray-200">
  <Zap className={cn('w-4 h-4', autoModeEnabled ? 'text-violet-500' : 'text-gray-400')} />
  <span className="text-sm font-semibold text-gray-700">Mode Auto</span>
  <button
    onClick={() => setAutoModeEnabled(!autoModeEnabled)}
    className={cn(
      'relative inline-flex h-6 w-11 items-center rounded-full transition-colors',
      autoModeEnabled ? 'bg-violet-500' : 'bg-gray-300'
    )}
  >
    <span
      className={cn(
        'inline-block h-4 w-4 transform rounded-full bg-white transition-transform',
        autoModeEnabled ? 'translate-x-6' : 'translate-x-1'
      )}
    />
  </button>
</div>
```

### **Logique automatique**

**Rules Engine** :
```typescript
const applyAutoRules = () => {
  if (!autoModeEnabled) return;
  
  const newValidations = new Map<string, DayValidation>();
  
  recommendations.forEach((reco) => {
    // Règle 1: Si confiance >= 85% → OK automatique
    if (reco.confidence >= 85) {
      newValidations.set(reco.date, {
        date: reco.date,
        choice: 'OK',
        manualPrice: null,
        recommendation: reco,
      });
    }
    
    // Règle 2: Si confiance < 60% → MAINTENIR
    else if (reco.confidence < 60) {
      newValidations.set(reco.date, {
        date: reco.date,
        choice: 'MAINTENIR',
        manualPrice: null,
        recommendation: reco,
      });
    }
    
    // Règle 3: Entre 60-85% → Nécessite validation manuelle
    else {
      newValidations.set(reco.date, {
        date: reco.date,
        choice: null,
        manualPrice: null,
        recommendation: reco,
      });
    }
  });
  
  setValidations(newValidations);
};

// Appliquer au changement du mode
useEffect(() => {
  if (autoModeEnabled) {
    applyAutoRules();
  }
}, [autoModeEnabled, recommendations]);
```

---

## 4️⃣ WORKFLOW PROPAGATION AUTOMATIQUE

### **Objectif**
Pipeline temps réel : Validation RMS → Calendrier Tarifaire → D-EDGE → Formulaire Réservations

### **Architecture**

```typescript
// services/rms-workflow.ts
export async function propagatePricingChanges(validations: Map<string, DayValidation>) {
  const approvedChanges = Array.from(validations.values()).filter(
    (v) => v.choice === 'OK' || (v.choice === 'NON' && v.manualPrice)
  );
  
  for (const change of approvedChanges) {
    const finalPrice = change.choice === 'OK' 
      ? change.recommendation.recommendedPrice 
      : change.manualPrice!;
    
    // Étape 1: Mise à jour Calendrier Tarifaire (Supabase)
    await updatePricingCalendar({
      date: change.date,
      roomTypeId: 'default', // À adapter
      ratePlanId: 'default',
      price: finalPrice,
      source: 'rms_recommendation',
    });
    
    // Étape 2: Synchronisation D-EDGE
    await syncToDEdge({
      date: change.date,
      price: finalPrice,
      channelId: 'd-edge',
    });
    
    // Étape 3: Mise à jour cache formulaire réservations
    await updateReservationFormPricing({
      date: change.date,
      price: finalPrice,
    });
    
    // Étape 4: Log audit
    await logPricingChange({
      date: change.date,
      oldPrice: change.recommendation.currentPrice,
      newPrice: finalPrice,
      source: 'rms',
      confidence: change.recommendation.confidence,
      userId: currentUser.id,
    });
  }
}
```

**Bouton Apply dans UI** :
```tsx
<button
  onClick={async () => {
    await propagatePricingChanges(validations);
    toast.success('Tarifs propagés avec succès');
  }}
  disabled={validations.size === 0}
  className="flex items-center gap-1.5 px-4 py-2 bg-violet-500 text-white text-sm font-bold rounded-md hover:bg-violet-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
>
  <Zap className="w-4 h-4" />
  Appliquer & Propager ({validations.size})
</button>
```

---

## 5️⃣ VUE JOUR (CARTES)

### **Objectif**
Affichage type "cards" reprenant le design de l'image 2 : cartes par jour avec détails complets.

### **Toggle View Mode**

**Dans toolbar** :
```tsx
<div className="flex items-center gap-1 bg-gray-100 rounded-md p-0.5">
  <button
    onClick={() => setDisplayMode('table')}
    className={cn(
      'px-3 py-1 text-xs font-semibold rounded flex items-center gap-1.5 transition-colors',
      displayMode === 'table'
        ? 'bg-white text-violet-700 shadow-sm'
        : 'text-gray-600 hover:text-gray-900'
    )}
  >
    <LayoutList className="w-3.5 h-3.5" />
    Tableau
  </button>
  
  <button
    onClick={() => setDisplayMode('cards')}
    className={cn(
      'px-3 py-1 text-xs font-semibold rounded flex items-center gap-1.5 transition-colors',
      displayMode === 'cards'
        ? 'bg-white text-violet-700 shadow-sm'
        : 'text-gray-600 hover:text-gray-900'
    )}
  >
    <Grid3x3 className="w-3.5 h-3.5" />
    Jour
  </button>
</div>
```

### **Cards Layout**

```tsx
{displayMode === 'cards' && (
  <div className="p-6 bg-gray-50">
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
      {dateColumns.map((col) => {
        const recommendation = recommendations.find((r) => r.date === col.date);
        const validation = validations.get(col.date);
        const compsetStatsForDay = getCompsetStats(col.date);
        
        return (
          <div
            key={col.date}
            className="bg-white border border-gray-200 rounded-lg p-4 hover:shadow-lg transition-shadow"
          >
            {/* Header */}
            <div className="flex items-center justify-between mb-3">
              <div>
                <span className="text-sm font-semibold text-gray-700">
                  {col.dayName}. {col.dayNumber}/{col.month}
                </span>
                {col.events.length > 0 && (
                  <div className="mt-1">
                    <span className="text-[10px] px-1.5 py-0.5 bg-purple-100 text-purple-700 rounded font-semibold">
                      {col.events[0].name}
                    </span>
                  </div>
                )}
              </div>
              
              {validation?.choice && (
                <span className={cn(
                  'px-2 py-1 text-[10px] font-bold rounded',
                  validation.choice === 'OK' && 'bg-emerald-100 text-emerald-700',
                  validation.choice === 'NON' && 'bg-red-100 text-red-700',
                  validation.choice === 'MAINTENIR' && 'bg-blue-100 text-blue-700'
                )}>
                  {validation.choice}
                </span>
              )}
            </div>
            
            {/* Metrics */}
            <div className="space-y-2 mb-3">
              <div className="flex items-center justify-between text-xs">
                <span className="text-gray-500">Dispo</span>
                <span className="font-semibold text-gray-800">0 ch</span>
              </div>
              
              <div className="flex items-center justify-between text-xs">
                <span className="text-gray-500">Prix actuel</span>
                <span className="font-bold text-gray-800">
                  {recommendation?.currentPrice.toFixed(0)}€
                </span>
              </div>
              
              <div className="flex items-center justify-between text-xs">
                <span className="text-gray-500">Prix suggéré</span>
                <span className="font-bold text-violet-600">
                  {recommendation?.recommendedPrice.toFixed(0)}€
                </span>
              </div>
              
              <div className="flex items-center justify-between text-xs">
                <span className="text-gray-500">Médiane</span>
                <span className="font-semibold text-gray-700">
                  {compsetStatsForDay.median.toFixed(0)}€
                </span>
              </div>
            </div>
            
            {/* Validation Buttons */}
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => handleValidationChoice(col.date, 'OK')}
                className={cn(
                  'flex-1 px-2 py-1.5 text-xs font-semibold rounded border transition-colors',
                  validation?.choice === 'OK'
                    ? 'bg-emerald-500 text-white border-emerald-500'
                    : 'bg-white text-gray-700 border-gray-300 hover:border-emerald-500'
                )}
              >
                ✓ Accepter
              </button>
              
              <button
                onClick={() => handleValidationChoice(col.date, 'MAINTENIR')}
                className={cn(
                  'flex-1 px-2 py-1.5 text-xs font-semibold rounded border transition-colors',
                  validation?.choice === 'MAINTENIR'
                    ? 'bg-blue-500 text-white border-blue-500'
                    : 'bg-white text-gray-700 border-gray-300 hover:border-blue-500'
                )}
              >
                − Maintenir
              </button>
            </div>
            
            {/* Manual edit if NON */}
            {validation?.choice === 'NON' && (
              <div className="mt-2">
                <input
                  type="number"
                  value={validation.manualPrice || ''}
                  onChange={(e) => handleManualPriceChange(col.date, Number(e.target.value))}
                  className="w-full px-3 py-2 text-sm text-center border border-violet-500 rounded focus:outline-none focus:ring-2 focus:ring-violet-500"
                  placeholder="Saisir tarif manuel"
                />
              </div>
            )}
          </div>
        );
      })}
    </div>
  </div>
)}
```

---

## 6️⃣ UX AMÉLIORATIONS PREMIUM

### **Espacements propres**
```css
/* Augmenter breathing space */
.pricing-cell {
  @apply px-3 py-2.5; /* au lieu de px-2 py-2 */
}

.table-row {
  @apply h-12; /* hauteur fixe 48px */
}

.header-cell {
  @apply py-3; /* au lieu de py-2 */
}
```

### **Hover élégants**
```tsx
// Sur lignes compset
className="hover:bg-gray-50 hover:shadow-sm transition-all duration-200"

// Sur boutons validation
className="hover:scale-105 active:scale-95 transition-transform duration-150"

// Sur cartes jour
className="hover:shadow-xl hover:-translate-y-1 transition-all duration-200"
```

### **Badges plus lisibles**
```tsx
// Segments avec tailles cohérentes
className="min-w-[80px] text-center px-2.5 py-1 text-[11px] font-bold rounded"

// Confiance score avec gradient
className={cn(
  'px-3 py-1.5 text-xs font-bold rounded-full',
  score >= 85 && 'bg-gradient-to-r from-emerald-500 to-emerald-600 text-white',
  score >= 60 && score < 85 && 'bg-gradient-to-r from-yellow-400 to-yellow-500 text-gray-900',
  score < 60 && 'bg-gradient-to-r from-red-500 to-red-600 text-white'
)}
```

### **Transitions fluides**
```css
/* Collapse/Expand smooth */
.compset-section {
  transition: max-height 0.3s cubic-bezier(0.4, 0, 0.2, 1),
              opacity 0.3s ease-in-out;
}

/* Validation buttons */
.validation-btn {
  transition: all 0.15s cubic-bezier(0.4, 0, 0.2, 1);
}

/* Mode switch */
.mode-toggle {
  transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}
```

---

## 7️⃣ COLONNES MIEUX PROPORTIONNÉES

### **Grid responsive amélioré**
```typescript
const getGridTemplate = (viewPeriod: string, colCount: number) => {
  // Vue 7 jours : colonnes larges (120px min)
  if (viewPeriod === '7days') {
    return `${LABEL_W}px repeat(${colCount}, minmax(120px, 1fr))`;
  }
  
  // Vue 15 jours : colonnes moyennes (70px min)
  if (viewPeriod === '15days') {
    return `${LABEL_W}px repeat(${colCount}, minmax(70px, 1fr))`;
  }
  
  // Vue 30 jours : colonnes compactes (45px min)
  return `${LABEL_W}px repeat(${colCount}, minmax(45px, 1fr))`;
};
```

### **Responsive breakpoints**
```tsx
// Mobile: forcer vue cards
const isMobile = useMediaQuery('(max-width: 768px)');

useEffect(() => {
  if (isMobile) {
    setDisplayMode('cards');
  }
}, [isMobile]);

// Tablet: réduire automatiquement à 7j
const isTablet = useMediaQuery('(max-width: 1024px)');

useEffect(() => {
  if (isTablet && viewPeriod === '30days') {
    setViewPeriod('15days');
  }
}, [isTablet]);
```

---

## 📊 ESTIMATION COMPLEXITÉ

| Feature | Lignes code | Difficulté | Priorité |
|---------|-------------|------------|----------|
| Codes couleur MIN/MAX/MEDIAN | ~150 | Facile | ⭐⭐⭐ |
| Second tableau validation | ~400 | Moyen | ⭐⭐⭐ |
| Mode automatique | ~200 | Facile | ⭐⭐ |
| Workflow propagation | ~300 | Difficile | ⭐⭐⭐ |
| Vue jour (cartes) | ~350 | Moyen | ⭐⭐ |
| UX améliorations | ~200 | Facile | ⭐⭐ |
| Colonnes responsive | ~100 | Facile | ⭐ |
| **TOTAL** | **~1700** | | |

---

## 🎯 PHASES D'IMPLÉMENTATION

### **Phase 1 : Visuels (Jour 1)**
1. ✅ Codes couleur MIN/MAX/MEDIAN
2. ✅ UX améliorations (espacements, hover, badges)
3. ✅ Colonnes mieux proportionnées

### **Phase 2 : Validation (Jour 2)**
4. ✅ Second tableau validation
5. ✅ Handlers OK/NON/MAINTENIR
6. ✅ Édition manuelle si NON

### **Phase 3 : Automation (Jour 3)**
7. ✅ Mode automatique switch
8. ✅ Rules engine
9. ✅ Vue jour (cartes)

### **Phase 4 : Intégration (Jour 4)**
10. ✅ Workflow propagation Calendrier
11. ✅ Sync D-EDGE
12. ✅ Update formulaire réservations
13. ✅ Audit logs

---

## 🚀 RÉSULTAT ATTENDU

Un module RMS **enterprise-grade** qui :
- ✅ Donne l'impression d'un outil utilisé par **Marriott, Hilton, Accor**
- ✅ Workflow **100% automatisé** si mode auto activé
- ✅ **Validation manuelle** granulaire si besoin
- ✅ **Propagation temps réel** vers tous les systèmes
- ✅ **UX premium** fluide et cohérente
- ✅ **Performance** : <500ms pour afficher 30 jours × 10 concurrents

**Le RMS devient le cœur opérationnel du yield management Flowtym.** 💎

