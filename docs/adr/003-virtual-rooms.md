# ADR-003 — Chambres virtuelles : composition côté client + cascade d'inventaire

**Date** : 2026-05-26
**Statut** : Accepté
**Contexte** : Module Paramètres > Chambres & inventaire

## Problème

Le métier hôtelier nécessite de vendre des **combinaisons de chambres
physiques** comme des unités distinctes :

- "Deux chambres adjacentes" (Family) — 2 standards côte à côte
- "Chambres communicantes" — 2 unités reliées par une porte intérieure
- "Suite composée" — chambre + salon attenant
- "Twin/Double interchangeable" — même unité vendable de 2 façons

Contraintes :

1. **Cohérence inventaire** : vendre la virtuelle doit décrémenter les
   composantes ; vendre une composante doit décrémenter la virtuelle.
2. **Pas de double vente** : un unique stock physique sous-jacent.
3. **Visible dans tous les modules** : Calendar, Planning, RMS, Distribution.
4. **Marquage clair** : différencier virtuelles vs physiques côté UI.

## Décision

Modélisation **côté client** dans le `useRateCalendarStore` (source unique
de vérité). Chambre virtuelle = `RoomTypeData` avec champs additionnels :

```ts
interface RoomTypeData {
  // ...
  isVirtual?: boolean;
  virtualKind?: 'adjacent' | 'connecting' | 'suite_combo' | 'family_combo' | 'split_twin' | 'custom';
  virtualComposition?: {
    componentRoomTypeIds: string[];
    componentsRequired: 'all' | 'any';
  };
}
```

### Moteur de cascade pur

`VirtualRoomCascadeEngine.ts` expose 3 fonctions pures :

- `computeVirtualInventoryForDate(virtual, allRooms, date)` :
  - mode `all` → `V_inv = min(C_inv)` (toutes composantes requises)
  - mode `any` → `V_inv = sum(C_inv)` (stock cumulé)
- `propagateVirtualRoomCascade(rooms, mutatedId, date)` :
  - si mutation = physique → recalcule les virtuelles affectées
  - si mutation = virtuelle (mode all) → cap les composantes au niveau V
- `rebuildAllVirtualInventories(rooms)` : recompute global au load

### Côté Supabase

Persistance dédiée dans `settings_virtual_rooms` (table spécifique, pas
config_blob) car relation avec les chambres physiques.

## Conséquences

### Positives
- **Moteur pur testable** sans React (10 tests passent en 7ms)
- Tous les consommateurs du store (RMS, Calendar, Planning, Channel
  Manager, Distribution) voient automatiquement les inventaires cohérents
- **Pas de logique côté serveur** initialement (Phase 1) → setup rapide
- Création + édition + suppression depuis Paramètres > Types de chambres

### Négatives
- **Double-vente théorique** si deux clients réservent en même temps
  sur 2 canaux. Mitigation Phase 2 : moteur d'inventaire côté Supabase
  avec verrous optimistes + RPC `cascade_virtual_inventory`.
- **Pas de validation OTA** : un OTA voit la virtuelle comme une typologie
  normale. Mitigation : marquer `isVirtual` dans le mapping channel manager
  et bloquer la double-publication (à faire).

## Alternatives considérées

- **Tout côté Supabase via triggers SQL** : trop tôt, complexité
  élevée, debug difficile en dev local. À reconsidérer Phase 2.
- **Vue matérialisée** : pas de mutation possible, ne marche que pour
  la lecture.
- **Pas de chambres virtuelles, juste des room_type "combo"** :
  perte de la sémantique (impossible de savoir quelles composantes
  sont impliquées).

## Implémentation

- `frontend/src/components/rms/engines/VirtualRoomCascadeEngine.ts`
- `frontend/src/pages/settings/pages/VirtualRoomModal.tsx`
- `frontend/src/pages/settings/pages/RoomTypesPage.tsx` (édition/suppression)
- Migration : `supabase/migrations/20260524_settings_phase2.sql`
  (table `settings_virtual_rooms`)
