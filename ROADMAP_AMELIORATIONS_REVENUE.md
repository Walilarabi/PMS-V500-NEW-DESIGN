# 🎯 ROADMAP AMÉLIORATIONS REVENUE MANAGEMENT - PHASE 1

## 📋 PRIORITÉ 1 - IMPLÉMENTATION IMMÉDIATE (Cette session)

### 1️⃣ CALENDRIER TARIFAIRE

#### A.2 - Date du jour par défaut ✅
**Impact** : Haute (UX quotidienne)  
**Complexité** : Faible  
**Durée** : 30 min

**Actions** :
- Modifier PricingCalendar.tsx pour calculer date du jour
- `const today = new Date(); today.setHours(0,0,0,0);`
- Scroll automatique vers aujourd'hui à l'ouverture
- Highlight visuel de la date du jour

---

#### A.3 - Édition rapide Excel-style ✅
**Impact** : Critique (productivité)  
**Complexité** : Haute  
**Durée** : 6-8h

**Fonctionnalités** :
1. **Navigation TAB** :
   - TAB = cellule suivante
   - SHIFT+TAB = cellule précédente
   - ENTER = ligne suivante même colonne

2. **Écrasement direct** :
   - Taper un chiffre = écrase immédiatement l'ancienne valeur
   - Pas de suppression manuelle requise
   - Focus automatique sur le champ

3. **Propagation automatique** :
   - Identifier chambre référente (Double Classique)
   - Calculer coefficient par chambre dérivée
   - Update temps réel lors modif référente

4. **Support copier/coller** :
   - Ctrl+C / Ctrl+V multi-cellules
   - Détection format Excel (TSV)
   - Update batch optimisé

5. **8 chambres fixes** :
   - Double Classique (RÉFÉRENTE)
   - Double Single Use Classique
   - Twin Classique
   - Double Classique Terrasse
   - Double Deluxe
   - Twin Deluxe
   - Double Deluxe Terrasse
   - Deux Chambres Adjacentes 4 personnes

**Architecture** :
```typescript
interface RoomRate {
  room_id: string;
  room_name: string;
  is_reference: boolean;
  coefficient: number; // multiplicateur vs référente
}

const ROOM_HIERARCHY = [
  { name: 'Double Classique', is_reference: true, coefficient: 1.00 },
  { name: 'Double Single Use Classique', is_reference: false, coefficient: 0.95 },
  { name: 'Twin Classique', is_reference: false, coefficient: 1.02 },
  { name: 'Double Classique Terrasse', is_reference: false, coefficient: 1.15 },
  { name: 'Double Deluxe', is_reference: false, coefficient: 1.25 },
  { name: 'Twin Deluxe', is_reference: false, coefficient: 1.27 },
  { name: 'Double Deluxe Terrasse', is_reference: false, coefficient: 1.40 },
  { name: 'Deux Chambres Adjacentes 4 personnes', is_reference: false, coefficient: 1.80 },
];
```

---

### 2️⃣ RMS TABLEAU

#### F.1 - Repositionnement menu ✅
**Impact** : Moyenne (navigation)  
**Complexité** : Faible  
**Durée** : 5 min

**Actions** :
- Fusionner "Règles tarifaires" et "Yield Management" dans RMS
- Nouveau menu Revenue > Automatisation :
  1. Tableau RMS (nouveau hub central)
  2. Promotions

---

#### F.2 - Alimentation colonnes automatique ✅
**Impact** : Critique (automation)  
**Complexité** : Moyenne  
**Durée** : 4-5h

##### Colonne Événement
**Source** : `DATES_SALONS__MISE_A_JOUR_25032026.xlsx` (onglet 2026)

**Structure données** :
```typescript
interface Event {
  month: string;
  name: string;
  start_date: Date;
  end_date: Date;
  location: string;
  impact: '🔴 Fort' | '🟠 Moyen';
  source: string;
}
```

**55 événements 2026** extraits :
- Maison & Objet (15-19 jan)
- Who's Next (17-19 jan)
- Sirha Europain (17-20 jan)
- Mode Masculine (20-25 jan)
- Retromobile (28 jan - 1 fév)
- Première Vision (3-5 fév)
- Tournoi 6 Nations (5 fév)
- Salon de l'Agriculture (22 fév - 2 mar)
- Roland Garros (26 mai - 11 juin) ← CRITIQUE FOLKESTONE OPÉRA
- ... (55 total)

**Parsing** :
```python
import openpyxl
wb = openpyxl.load_workbook('DATES_SALONS__MISE_A_JOUR_25032026.xlsx')
ws = wb['2026']

events = []
for row in ws.iter_rows(min_row=2, values_only=True):
    if row[1]:  # Événement name
        events.append({
            'month': row[0],
            'name': row[1],
            'start': row[2],
            'end': row[3],
            'location': row[4],
            'impact': row[5],
            'source': row[6]
        })
```

**Affichage RMS** :
- Si date dans range événement → badge avec nom événement
- Couleur selon impact (rouge = Fort, orange = Moyen)
- Tooltip avec détails (lieu, dates, source)

---

##### Colonne Marché (Lighthouse)
**Source** : `folkestoneopéra_bookingdotcom_lowest_los1_2guests_1.xlsx` (onglet "Aperçu")

**Structure données** :
```typescript
interface MarketData {
  date: Date;
  day: string;
  our_price: number;
  compset_median: number;
  compset_ranking: string; // "9 sur 11"
  market_demand: number; // 0-1 (0.147 = 14.7%)
  booking_ranking: string; // "151 sur 842"
  holidays: string;
  events: string;
}
```

**10 concurrents Lighthouse** :
1. Hôtel Madeleine Haussmann
2. Hôtel De l'Arcade
3. Hôtel Cordelia Opéra-Madeleine
4. Queen Mary Opera
5. Hôtel du Triangle d'Or - Proche Madeleine
6. Best Western Plus Hotel Sydney Opera
7. Hotel Opéra Opal
8. Hôtel Royal Opéra
9. Hotel George Sand Opéra Paris
10. Hotel Chavanel

**Parsing** :
```python
import openpyxl
wb = openpyxl.load_workbook('folkestoneopéra_bookingdotcom_lowest_los1_2guests_1.xlsx')
ws = wb['Aperçu']

market_data = []
for row in ws.iter_rows(min_row=6, values_only=True):
    market_data.append({
        'day': row[1],
        'date': row[2],
        'our_price': row[3],
        'compset_median': row[4],
        'ranking': row[5],
        'market_demand': row[6],  # 0.147 = 14.7%
        'booking_ranking': row[7],
    })
```

**Affichage RMS** :
- Colonne "Pression Marché" = `market_demand × 100` (en %)
- Badge coloré :
  - 0-40% : 🟢 Vert (faible)
  - 40-70% : 🟡 Jaune (moyen)
  - 70-100% : 🔴 Rouge (fort)

---

### 3️⃣ RECHERCHE ÉVÉNEMENTS (Phase 2)

#### Modal recherche avec autocomplete
**Impact** : Moyenne  
**Complexité** : Moyenne  
**Durée** : 2-3h

**Features** :
- Input search avec autocomplete
- Filtres : Mois / Impact / Lieu
- Liste événements matchés
- Ajout événement custom
- Persistance Supabase

---

## 📦 FICHIERS À CRÉER/MODIFIER

### Frontend

#### Nouveaux fichiers
1. `/frontend/src/utils/events-parser.ts` - Parser XLSX salons
2. `/frontend/src/utils/lighthouse-parser.ts` - Parser XLSX Lighthouse
3. `/frontend/src/hooks/useEventsData.ts` - Hook chargement événements
4. `/frontend/src/hooks/useMarketData.ts` - Hook chargement Lighthouse

#### Fichiers à modifier
1. `/frontend/src/pages/revenue/PricingCalendar.tsx` - Date du jour
2. `/frontend/src/components/calendar/CalendarGrid.tsx` - Édition Excel-style
3. `/frontend/src/pages/revenue/RateManager.tsx` - Colonnes auto
4. `/frontend/src/components/layout/Sidebar.tsx` - Menu restructuré

---

### Backend

#### Migration Supabase
```sql
-- Table événements
CREATE TABLE rms_events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID REFERENCES tenants(id),
  name TEXT NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  location TEXT,
  impact TEXT CHECK (impact IN ('Fort', 'Moyen')),
  source TEXT,
  is_custom BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index performance
CREATE INDEX idx_rms_events_dates ON rms_events(start_date, end_date);
CREATE INDEX idx_rms_events_tenant ON rms_events(tenant_id);

-- RLS
ALTER TABLE rms_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant isolation" ON rms_events
  FOR ALL USING (tenant_id = current_setting('app.current_tenant')::UUID);
```

---

## 🎯 ORDRE D'EXÉCUTION

### Session 1 (Maintenant) - 8-10h
1. ✅ Parser fichiers XLSX (30 min)
2. ✅ Calendrier : Date du jour (30 min)
3. ✅ RMS : Colonnes événement + marché (3h)
4. ✅ Sidebar : Restructuration menu (15 min)
5. ✅ Calendrier : Édition Excel-style (4-6h)

### Session 2 (Demain) - 4h
1. ⏳ Modal recherche événements
2. ⏳ Upload manuel Lighthouse
3. ⏳ Tests E2E

---

## ⚠️ POINTS D'ATTENTION

1. **Performance** :
   - Parser XLSX côté client = lent (>100KB)
   - Solution : background job + cache Supabase
   - Alternative court terme : static JSON généré

2. **Multi-tenant** :
   - Événements globaux (Paris) vs custom par hôtel
   - Flag `is_custom` pour différencier

3. **Coefficients chambres** :
   - Doivent être configurables par hôtel
   - Actuellement hardcodés (OK phase 1)
   - Phase 2 : table `room_rate_coefficients`

4. **Lighthouse updates** :
   - Fichier change quotidiennement
   - Upload manuel phase 1
   - Phase 2 : API Lighthouse (si disponible)

---

## 📊 MÉTRIQUES SUCCÈS

- [ ] Date du jour automatique ✅
- [ ] TAB navigation fonctionne ✅
- [ ] Écrasement direct chiffres ✅
- [ ] Propagation chambres dérivées ✅
- [ ] Événements affichés RMS ✅
- [ ] Pression marché correcte ✅
- [ ] Build < 15s ✅
- [ ] Aucune régression ✅
