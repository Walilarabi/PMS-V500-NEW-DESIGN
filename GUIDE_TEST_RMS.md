# GUIDE DE TEST - RMS ENTERPRISE

## 🧪 COMMENT TESTER CHAQUE PAGE

### **MÉTHODE 1 : Via la Sidebar (Navigation normale)**

Les pages accessibles via le menu :

1. **Calendrier Tarifaire** ✅  
   - Menu : Revenue > Pilotage > "Calendrier tarifaire"
   - Route : `rev_pricing`

2. **Rate Manager** ✅  
   - Menu : Revenue > Automatisation > "Tableau RMS"
   - Route : `rms`

3. **Canaux & OTA** ✅  
   - Menu : Revenue > Distribution > "Canaux & OTAs"
   - Route : `rev_channels`

4. **Règles Tarifaires** ✅  
   - Menu : Revenue > Automatisation > "Règles tarifaires"
   - Route : `rev_rules`

5. **Promotions** ✅  
   - Menu : Revenue > Automatisation > "Promotions"
   - Route : `rev_promotions`

6. **Veille Concurrentielle** ⚠️  
   - Menu : Revenue > Distribution > "Veille concurrentielle"
   - Route : `rev_market` (pointe vers ancienne version)
   - **DOIT POINTER VERS** : `CompetitiveIntel` (nouvelle version)

### **PAGES NON ACCESSIBLES** (pas de route dans menu)

7. **Decision History** ❌  
   - Pas de menu
   - Route App.tsx : `rms_history`
   - **SOLUTION** : Accessible via bouton "Historique" dans Rate Manager

---

## 🔍 DIAGNOSTICS PAR PAGE

### 1. CALENDRIER TARIFAIRE
**Fichier** : `PricingCalendar.tsx` + `CalendarGrid.tsx`  
**Statut** : ✅ Devrait fonctionner  
**Test** : Cliquer sur "Calendrier tarifaire" dans le menu

**Si ne s'affiche pas** :
- Vérifier console browser (F12) pour erreurs
- Vérifier que `CalendarGrid.tsx` existe
- Vérifier imports `ToastProvider`

### 2. RATE MANAGER  
**Fichier** : `RateManager.tsx`  
**Statut** : ✅ Corrigé (commit 2e2985e)  
**Test** : Cliquer sur "Tableau RMS"

**Fonctionnalités corrigées** :
- ✅ Date = aujourd'hui
- ✅ Événements visibles (EUROPCAR)
- ✅ Pression marché en %
- ✅ Champ édition manuelle après refus
- ✅ Modal détails concurrents (clic sur Eye)

### 3. DECISION HISTORY
**Fichier** : `DecisionHistory.tsx`  
**Statut** : ✅ Code correct MAIS pas de route menu  
**Test** : Cliquer bouton "Historique" dans Rate Manager

**Si ne s'affiche pas** :
- Vérifier que le bouton dans RateManager existe
- Vérifier route `rms_history` dans App.tsx

### 4. COMPETITIVE INTEL
**Fichier** : `CompetitiveIntel.tsx`  
**Statut** : ✅ Code correct MAIS route incorrecte  
**Problème** : Menu pointe vers `MarketIntelligence` (ancienne version)  
**Solution** : Modifier Sidebar pour pointer vers `CompetitiveIntel`

**Test actuel** : Menu affiche l'ancienne version  
**Test après correction** : Nouvelle version avec 4 KPIs + graphiques

### 5. CHANNELS
**Fichier** : `Channels.tsx`  
**Statut** : ✅ Code correct  
**Test** : Menu > "Canaux & OTAs"

### 6. PRICING RULES
**Fichier** : `PricingRules.tsx`  
**Statut** : ✅ Code correct  
**Test** : Menu > "Règles tarifaires"

### 7. PROMOTIONS
**Fichier** : `Promotions.tsx`  
**Statut** : ⚠️ UI basique (à améliorer)  
**Test** : Menu > "Promotions"

---

## 📋 CHECKLIST DE VÉRIFICATION

Pour chaque page, vérifier :

```
□ Header s'affiche (titre + icône)
□ KPI Cards s'affichent
□ Tableau/Contenu principal visible
□ Boutons cliquables
□ Pas d'erreur console
□ Scroll fonctionne
□ Design cohérent
```

---

## 🐛 SI UNE PAGE NE S'AFFICHE PAS

1. **Ouvrir Console Browser** (F12)
2. **Chercher erreurs rouges**
3. **Vérifier Network tab** (erreurs 404)
4. **Vérifier** que le code build sans erreur

**Erreurs communes** :
- Import manquant
- Composant non exporté
- Route incorrecte dans App.tsx
- CSS/Tailwind classe invalide

---

## ✅ PROCHAINES CORRECTIONS À FAIRE

1. ✅ **Rate Manager** - FAIT
2. ⏳ **Decision History** - Ajouter route menu OU garder via bouton
3. ⏳ **Competitive Intel** - Corriger route Sidebar
4. ⏳ **Promotions** - Améliorer UI
5. ⏳ **Tous** - Vérifier affichage réel en production
