# 📊 FLOWTYM — Brief technique parser Expedia Revenue Management

> **Date** : 19 mai 2026
> **Source** : `expedia_revenue_management_16973_2026_05_19.xlsx`
> **Auteur** : Architecte technique
> **Statut** : Validé pour implémentation

---

## 🎯 Verdict stratégique

**L'idée d'intégrer Expedia comme source alternative gratuite à Lighthouse est EXCELLENTE.**

### Pourquoi
- **Coût** : 0€/mois (inclus dans Expedia Partner Central pour tout hôtel sur Expedia)
- **Couverture** : 99% des hôtels prospects sont déjà sur Expedia
- **Données** : suffisantes pour alimenter un RMS de base
- **Différenciation** : permet de pitcher Flowtym à 200-300€/mois (sans Lighthouse) vs Duetto/Atomize à 500-1500€

### Conséquence pour le pitch dans 2 mois
Tu peux proposer **2 niveaux de prix** :
- **Flowtym Standard** (300€/mois) : Expedia gratuit suffit
- **Flowtym Pro** (500-700€/mois) : Lighthouse + Expedia croisés pour précision maximale

---

## 📐 Structure du fichier Expedia

### Métadonnées (lignes 1-3)
| Ligne | Contenu | Exploitable |
|---|---|---|
| 1 | Date d'export (ex: `2026-05-19 15:16`) | ✅ |
| 2 | Marché de référence (ex: `France - Expedia.fr (EUR) \| 1 night \| 2 adults`) | ✅ |
| 3 | Verdict global Expedia (ex: `Your competitors' rates are lower than yours`) | ⚠️ (signal mais peu actionnable) |

### Headers de dates (lignes 5-7)
| Ligne | Rôle | Exemple |
|---|---|---|
| 5 | Mois (1 cellule par changement de mois) | `MAY 2026` en col 2, `JUNE 2026` en col 15, etc. |
| 6 | Jour de la semaine | `Tue`, `Wed`, etc. |
| 7 | Numéro du jour | `19`, `20`, `21` |

**Couverture totale : 364 jours** (~1 an glissant à partir de la date d'export)

### Données tarifaires (lignes 8-22)
| Ligne | Données | Type valeur |
|---|---|---|
| 8 | **Your Property** (votre hôtel) | Nombre EUR OU `Min. N nights` OU `Sold out` |
| 9 | **Competitive set average** | Nombre EUR uniquement |
| 10-22 | **13 concurrents nommés** | Nombre EUR OU `Sold out` OU `Min. N nights` |

### Pression marché (lignes 24-26)
| Ligne | Données | Type valeur |
|---|---|---|
| 24 | **Paris (and vicinity), France** — volume de recherches élargie | Entier (ex: `368917`) |
| 26 | **8th Arrondissement - L'Europe** — volume voisinage immédiat | Entier (ex: `27167`) |

---

## 🏨 Compset Expedia (13 concurrents)

Liste exacte récupérée :
1. Hotel Queen Mary Paris
2. Masséna Hôtel
3. Le Petit Madeleine Hôtel
4. Hotel Concortel
5. Best Western Plus Hotel Sydney Opera
6. Hotel 10 Opera by HappyCulture
7. Hôtel Alison
8. Hôtel Cordelia Opéra-Madeleine
9. Hôtel George Sand Opéra Paris
10. Hôtel Madeleine Haussmann
11. Hotel Opéra Opal
12. Hotel Royal Opera
13. Le Relais Madeleine

⚠️ **Compset Expedia ≠ Compset Lighthouse** (10 hôtels). Il y aura des **overlaps** mais aussi des hôtels différents.

---

## 🧮 Logique de parsing recommandée

### TypeScript interface
```typescript
export interface ExpediaImport {
  fileName: string;
  importedAt: string;        // ISO
  exportedAt: string;        // depuis ligne 1
  market: string;            // depuis ligne 2
  globalVerdict: string;     // depuis ligne 3
  ourHotelName: string;      // "Your Property" (label fixe)
  competitorNames: string[]; // 13 hôtels
  days: ExpediaDayData[];
}

export interface ExpediaDayData {
  date: string;              // ISO YYYY-MM-DD reconstitué
  dayName: string;
  ourPrice: number | null;
  ourPriceStatus: 'available' | 'restricted' | 'sold_out';
  ourPriceRestriction?: string;  // "Min. 2 nights"
  compsetAverage: number | null;
  competitors: ExpediaCompetitor[];
  // Pression marché
  searchVolumeBroader: number | null;    // Paris and vicinity
  searchVolumeNeighborhood: number | null;  // 8th Arrondissement
  // Calculé : normalisation pression
  marketPressureBroaderPercent: number;     // 0-100
  marketPressureNeighborhoodPercent: number;  // 0-100
}

export interface ExpediaCompetitor {
  hotelName: string;
  price: number | null;
  status: 'available' | 'restricted' | 'sold_out';
  restriction?: string;
  rawValue: string | number;
}
```

### Algorithme de parsing
1. Lire ligne 1 → `exportedAt`
2. Lire ligne 2 → `market`
3. Lire ligne 3 → `globalVerdict`
4. Reconstituer les dates en parcourant lignes 5-7 :
   - Ligne 5 donne le mois courant
   - Ligne 7 donne le jour
   - Combiner → `YYYY-MM-DD`
5. Pour chaque colonne de date :
   - Ligne 8 → `ourPrice` (typage : number = OK, "Sold out" = sold_out, "Min. N nights" = restricted)
   - Ligne 9 → `compsetAverage` (toujours numérique)
   - Lignes 10-22 → boucle sur les 13 concurrents
   - Ligne 24 → `searchVolumeBroader`
   - Ligne 26 → `searchVolumeNeighborhood`

### Normalisation pression marché (point crucial)
Les volumes bruts (368917, 27167) ne sont pas exploitables directement. **Conversion en pourcentage relatif** :

```typescript
function normalizeMarketPressure(days: ExpediaDayData[]): void {
  const maxBroader = Math.max(...days.map(d => d.searchVolumeBroader ?? 0));
  const maxNeighborhood = Math.max(...days.map(d => d.searchVolumeNeighborhood ?? 0));

  days.forEach(day => {
    day.marketPressureBroaderPercent = maxBroader > 0
      ? Math.round((day.searchVolumeBroader ?? 0) / maxBroader * 100)
      : 0;
    day.marketPressureNeighborhoodPercent = maxNeighborhood > 0
      ? Math.round((day.searchVolumeNeighborhood ?? 0) / maxNeighborhood * 100)
      : 0;
  });
}
```

**Alternative plus sophistiquée** : utiliser le **percentile 90** au lieu du max, pour ne pas écraser les jours moyens si un jour exceptionnel domine.

---

## 🎯 Stratégie d'intégration recommandée — "Source primaire + override"

### Architecture recommandée
1. **Conservé** : bouton "Importer fichier Lighthouse" (existant)
2. **Ajouté** : bouton "Importer fichier Expedia" (nouveau)
3. **Store Zustand séparé** : `useExpediaStore` (parallèle à `useLighthouseStore`)
4. **Logique de fusion** dans le moteur RMS (`market-analysis-engine.ts`)

### Règles de fusion suggérées (à valider en équipe)
| Donnée | Source prioritaire | Source de fallback | Justification |
|---|---|---|---|
| Notre prix | Calendrier tarifaire interne | Lighthouse → Expedia | Source de vérité = calendrier |
| Compset prices | Lighthouse | Expedia | Lighthouse plus précis, scraping vs partner data |
| Compset médiane | Lighthouse | Expedia (`compsetAverage`) | Idem |
| Pression marché | Hybride **moyenne pondérée** | Lighthouse seul OU Expedia seul | Score composite robuste |
| Min/Max compset | Lighthouse | Expedia (calculé depuis les 13 concurrents) | Lighthouse plus complet |
| Restrictions (MinStay, CTA) | Lighthouse | Expedia (champ `Min. N nights`) | Lighthouse plus exhaustif |
| Volume recherche | Expedia (unique) | — | Lighthouse ne fournit pas ça |

### Score de pression hybride
```typescript
function computeHybridPressure(
  lighthousePressure: number | null,
  expediaPressure: number | null
): number {
  if (lighthousePressure !== null && expediaPressure !== null) {
    // Moyenne pondérée : Lighthouse plus mature, mais Expedia plus à jour
    return Math.round(lighthousePressure * 0.55 + expediaPressure * 0.45);
  }
  return lighthousePressure ?? expediaPressure ?? 0;
}
```

---

## 🚦 Plan d'implémentation (estimation : 1 semaine de dev focused)

### Sprint 1 (3 jours)
- [ ] Créer `expedia-parser.service.ts` (parser Excel)
- [ ] Tests unitaires parser sur le fichier `expedia_revenue_management_16973_2026_05_19.xlsx`
- [ ] Créer `useExpediaStore` (Zustand + persist)
- [ ] Créer table Supabase `expedia_imports` + `expedia_days` (snapshot versioning, comme Lighthouse)
- [ ] Bouton "Importer Expedia" dans `LighthouseMonthlyView.tsx`

### Sprint 2 (2 jours)
- [ ] Adapter `market-analysis-engine.ts` pour accepter une source Expedia
- [ ] Logique de fusion / fallback / score hybride
- [ ] Indicateur visuel dans Cockpit RMS : "Source : Lighthouse + Expedia" / "Source : Expedia seul"
- [ ] Affichage des données Expedia dans le RMS Tableau Pro (colonnes pression voisinage)

### Sprint 3 (2 jours)
- [ ] UI : nouvelle carte "Pression voisinage" dans onglet Marché
- [ ] Documentation utilisateur (page d'aide intégrée ou tooltip)
- [ ] Tests E2E (import → parse → enrichissement RMS → recommandation)

---

## 🔮 Vision future (au-delà du pitch)

### Phase 2 — Automatisation
Expedia Partner Central permet de configurer **l'envoi quotidien par email** du fichier Revenue Management. On peut :
1. Demander au client de configurer l'email automatique vers une adresse Flowtym dédiée (`expedia@flowtym.io`)
2. Service backend qui surveille la boîte (IMAP ou Postmark/SendGrid inbound)
3. Auto-import quotidien à 7h du matin
4. Flowtym devient **vraiment** un RMS temps réel gratuit

### Phase 3 — Multi-source
Ajout d'autres sources OTA gratuites :
- **Booking.com Analytics** (rapport similaire dispo)
- **Hotels.com**
- **Tripadvisor** (via leur partner program)

Score Flowtym = agrégat de 4-5 sources OTA → précision >= Lighthouse.

---

## ⚠️ Risques identifiés

| Risque | Niveau | Mitigation |
|---|---|---|
| Expedia change le format du fichier (en-têtes, colonnes) | 🟡 Moyen | Parser tolérant aux variations + alertes si parse échoue |
| Compset Expedia ≠ Compset Lighthouse (hôtels différents) | 🟢 Faible | Bonne chose : élargit la vision marché |
| Termes de service Expedia interdisent réutilisation B2B | 🔴 Élevé | **À vérifier en lisant les CGV Expedia Partner Central** avant tout pitch commercial |
| Volume de recherche brut trompeur sans normalisation | 🟢 Géré | Normalisation par max OU percentile 90 |
| L'hôtelier oublie d'importer chaque jour | 🟡 Moyen | Automatisation par email en Phase 2 |

⚠️ **Action légale prioritaire** : avant de pitcher l'intégration Expedia commercialement, **lire et valider les CGV Expedia Partner Central** concernant l'utilisation de leurs rapports dans un produit tiers. Si interdit, Flowtym reste utilisable côté hôtelier (chacun importe ses propres données), mais ne peut pas être vendu comme "intégration Expedia officielle".

---

## 📂 Tâches Claude Code pour quand tu reprends

### Prompt à donner à Claude Code (à coller tel quel)

```
Lis CLAUDE.md et le fichier EXPEDIA_PARSER_BRIEF.md à la racine.

Crée le parser Expedia en suivant exactement la spec du brief :

1. Crée frontend/src/services/expedia-parser.service.ts :
   - Interface ExpediaImport, ExpediaDayData, ExpediaCompetitor
   - Fonction parseExpediaExcel(file: File): Promise<ExpediaImport>
   - Lecture lignes 1-3 (méta), 5-7 (dates), 8-22 (prix), 24+26 (pression)
   - Normalisation pression (formule du brief, max comme dénominateur)
   - Gestion des valeurs "Sold out" et "Min. N nights"

2. Crée frontend/src/store/expediaStore.ts :
   - Pattern strictement identique à salonsStore.ts (Zustand + persist)
   - Clé localStorage : flowtym_expedia_import
   - Méthode getDataForDate(date): ExpediaDayData | null

3. Lance "cd frontend && npm run build" avant chaque commit.

4. Commits séparés (1 par fichier).

NE TOUCHE PAS encore à LighthouseMonthlyView ni au RMS — c'est un commit séparé après.
```

---

## 🎬 Bilan stratégique

Cette intégration Expedia **vaut probablement plus que toutes les features fancy** qu'on a discutées (Pricing Assistant, Time Machine, etc.). Pourquoi ?

Parce qu'**aucun de tes prospects ne peut payer Lighthouse à 250€/mois pour tester Flowtym**. En ayant une source gratuite intégrée, tu lèves la barrière à l'entrée et tu peux pitcher en disant : "Apportez votre fichier Expedia (vous l'avez déjà), je vous montre ce que Flowtym fait en 5 minutes".

**C'est LE killer feature pour ton pitch dans 2 mois.**

Donne la priorité à ça avant les autres "features cool" — elles viendront ensuite, sur des clients qui auront déjà signé.

---

**Document à conserver dans le repo à la racine.**
