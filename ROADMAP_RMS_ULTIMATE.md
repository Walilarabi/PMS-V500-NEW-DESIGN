# ROADMAP RMS ENTERPRISE ULTIMATE

## VISION
Créer le meilleur RMS hôtelier au monde, surpassant Duetto, IDeaS et Atomize.

## OBJECTIF MÉTIER
Maximiser RevPAR = ADR × Taux d'Occupation

## ARCHITECTURE (6 PAGES)

### PAGE 1 : RATE MANAGER ★★★★★
**Fichier** : `RateManager.tsx` (~1200 lignes)

**Section 1 : Heatmap Prédictive** (inspiré Image 1)
- Grille 14 jours (2 rangées × 7 colonnes)
- Cards couleur pastel selon TO + Pression
- Indicateurs : TO % + Pression marché (0-100)
- Codes couleur :
  * TO 0-50% : cyan-100
  * TO 50-75% : emerald-100
  * TO 75-90% : amber-100
  * TO 90%+ : red-100

**Section 2 : Toolbar Ultra-Performante**
- Période : 7j/1mois/60j/90j (boutons toggle)
- Vue : Tableau/Jour/Kanban
- AutoPilot : Toggle ON/OFF avec icône robot
- Recalculer (force refresh pricing engine)
- Export PDF

**Section 3 : Tableau RMS Métier** (23 colonnes)
1. ☐ Checkbox
2. 👁️ Détail
3. Jour
4. Date
5. Événement
6. Marché % (barre progress)
7. Dispo
8. TO % (bold coloré)
9. Médiane
10. Min
11. Max
12. Lead Time
13. Pickup %
14. Stratégie (dropdown 8 types)
15. Reco IA (icône + texte)
16. Actuel
17. Suggéré (violet bold)
18. **Final** (blue bold - le vrai prix)
19. Actions (3 boutons)
20. Statut (badge)

**Section 4 : Vue Jour (Cards)**
- Grid 4 colonnes responsive
- Carte par jour avec métriques essentielles
- Validation inline

**Section 5 : Vue Kanban**
- 3 colonnes (Augmenter/Maintenir/Baisser)
- Drag-drop (future)

---

### PAGE 2 : HISTORIQUE DÉCISIONS
**Fichier** : `DecisionHistory.tsx` (~400 lignes)

**KPI Cards Top**
- Acceptées (green)
- Refusées (red)  
- Maintenues (gray)

**Tableau Audit**
- Date, Jour, Événement
- Recommandation IA
- Prix initial/suggéré/final
- Décision (badge coloré)
- Stratégie

**Filtres**
- Statut (tous/acceptées/refusées/maintenues)
- Période (dropdown)

---

### PAGE 3 : VEILLE CONCURRENTIELLE
**Fichier** : `CompetitiveIntel.tsx` (~600 lignes)

**4 KPI Cards** (inspiré Image 4)
1. Position prix moyen : -3% (green si <marché)
2. Indice compétitivité : 82/100
3. Concurrents en hausse : 6/9
4. Variations détectées : 18 (dernières 24h)

**Tableau Concurrents Enrichi**
- Nom hôtel
- Catégorie étoiles (★★★★)
- Plateforme (Booking/Expedia/Direct)
- Leur prix
- Notre prix
- Positionnement (badge vert "Nous < marché" / rouge "Nous > marché")
- Dispo estimée (Faible/Moyenne/Élevée)
- Variation 7j (↗↘ %)
- Score Revpar

**Graph Historique Variations** (14 jours)
- Ligne notre prix (blue)
- Ligne médiane marché (orange)
- Ligne leader (violet)

**Graph Pression Marché** (7 prochains jours)
- Barres horizontales colorées
- Labels : Élevée/Très haute/Modérée

**Disponibilité Estimée Concurrents**
- Mini calendrier 7j
- Codes couleur selon dispo

**Positionnement par Segment**
- Budget (<130€) : 40%
- Économique (130-160€) : 55%
- Milieu (160-200€) : 72% ← Nous
- Haut de gamme (200-280€) : 82%
- Luxe (>280€) : 92%

---

### PAGE 4 : CANAUX & OTA
**Fichier** : `Channels.tsx` (~500 lignes)

**Dashboard Canaux**
- Cards par canal (Booking/Expedia/Direct/Airbnb)
- Volume réservations
- ADR moyen
- Commission %
- RevPAR contribution

**Performance Canal**
- Graphique 30j (volume par canal)
- Conversion rate

**Allocation Inventaire**
- Slider par canal (max rooms)
- Auto-allocation ON/OFF

**Restrictions**
- MLOS par canal
- CTA
- CTD

---

### PAGE 5 : RÈGLES TARIFAIRES
**Fichier** : `PricingRules.tsx` (~450 lignes)

**Rules Engine Visual**
- Liste règles actives
- Drag-drop priorités

**Règle Card**
- Nom
- Conditions (TO/Lead/Événement)
- Actions (±%, Min/Max, MLOS)
- Actif/Inactif toggle
- Edit/Delete

**Création Règle**
- Modal form
- Conditions builder
- Actions builder
- Test simulation

---

### PAGE 6 : PROMOTIONS
**Fichier** : `Promotions.tsx` (~350 lignes)

**Campagnes Actives**
- Cards promo
- Dates validité
- Réduction %
- Codes promo
- Performance (bookings générés)

**Calendrier Promotionnel**
- Vue mois
- Marqueurs dates promo

**Création Promo**
- Modal
- Type (%, fixed, nuits gratuites)
- Canaux ciblés
- Dates
