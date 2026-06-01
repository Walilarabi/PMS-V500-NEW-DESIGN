# ROADMAP SPRINT 2 — FLOWTYM PMS
## Post-pilote Folkestone | Démarrage estimé : J+30 après validation pilote

---

## Contexte

Le Sprint 1 (pilote Folkestone) valide le cœur fonctionnel :
réservations, facturation, housekeeping, et le module RMS complet
(Calendrier tarifaire · Tableau RMS · Veille Concurrentielle · Événements).

Le Sprint 2 activera les fonctionnalités masquées ou partiellesdu pilote
et étendra la plateforme vers la production multi-hôtel.

---

## Priorités Sprint 2

### P0 — Bloquants pour la mise en production complète

#### S2-001 : Channel Manager — intégration OTA réelle
**Scope** : `frontend/src/services/channel-manager.service.ts`
**Problème actuel** : `simulateProviderCall()` — aucun appel HTTP réel.
**Cible** : Brancher les API Booking.com Connectivity, Expedia QuickConnect.
Réactiver les lignes `[CM]` dans `PricingCalendar.tsx`.
**Critère de succès** : Un changement de prix dans le Calendrier tarifaire
est publié sur les extranets OTA dans les 60 secondes.
**Effort estimé** : L (5–8 jours, dépend des accréditations API OTA)

#### S2-002 : Synchronisation bi-directionnelle réservations OTA
**Scope** : Nouvelle Edge Function Supabase + webhook Booking.com
**Problème actuel** : Les réservations OTA sont saisies manuellement.
**Cible** : Les nouvelles réservations Booking/Expedia arrivent automatiquement
dans le Planning.
**Effort estimé** : L

#### S2-003 : Re-synchronisation Supabase après reconnexion hors-ligne
**Scope** : `eventsRepository.ts` + `eventsStore.ts`
**Problème actuel** : Si une écriture Supabase échoue (hors-ligne), la
donnée reste uniquement en localStorage. La reconnexion ne re-sync pas
automatiquement.
**Cible** : File d'attente locale des mutations en attente — re-sync
automatique au retour en ligne (`navigator.onLine` event).
**Effort estimé** : M (2–3 jours)

---

### P1 — Améliorations fonctionnelles majeures

#### S2-004 : rmsEngine dans DayDetailPanel (Veille)
**Scope** : `DayDetailPanel.tsx` lignes 123-128
**Problème actuel** : Formule locale de recommandation (4 conditions
hardcodées), indépendante de `rmsEngine`. Légère incohérence possible
avec le Tableau RMS.
**Cible** : Remplacer la formule locale par `calculateRecommendation()`
de `rmsEngine.ts` — cohérence garantie.
**Effort estimé** : S (1 jour)

#### S2-005 : Import Lighthouse automatisé (API live)
**Scope** : Nouvelle source dans `eventSourceLibrary.ts` + Edge Function
**Problème actuel** : Import XLS manuel quotidien.
**Cible** : Connexion API Lighthouse si disponible, ou scraping autorisé
via Edge Function. Déclenchement automatique chaque matin à 7h.
**Effort estimé** : L (dépend des droits API Lighthouse)

#### S2-006 : Clôture de journée automatisée
**Scope** : Nouvelle procédure + rapport journalier
**Problème actuel** : Clôture entièrement manuelle.
**Cible** : Rapport de clôture auto-généré (TO, ADR, RevPAR du jour,
encaissements, arrivées/départs) — envoi email à 23h ou à la demande.
**Effort estimé** : M

#### S2-007 : Export comptable (FEC / journal)
**Scope** : `billing` module + export service
**Problème actuel** : Pas d'export compatible logiciels comptables.
**Cible** : Export FEC (Fichier des Écritures Comptables) pour le
comptable externe. Format CSV/Excel conforme DGFiP.
**Effort estimé** : M

#### S2-008 : Multi-hôtel — dashboard consolidé
**Scope** : Super Admin + nouvelle page `/admin/dashboard`
**Problème actuel** : Chaque hôtel est isolé. Pas de vue consolidée.
**Cible** : Vue tableau de bord multi-propriétés pour le groupe hôtelier.
TO / ADR / RevPAR agrégés. Drill-down par hôtel.
**Effort estimé** : L

---

### P2 — Qualité et fiabilité

#### S2-009 : Régénération des types TypeScript Supabase
**Scope** : `frontend/src/lib/supabase.ts` + `eventsRepository.ts`
**Problème actuel** : `(supabase as any)` dans le repository events —
les types DB ne incluent pas encore `hotel_rms_events`.
**Cible** : `npx supabase gen types typescript` → remplacer tous les `as any`.
**Effort estimé** : XS (2h)

#### S2-010 : Correction erreurs TypeScript pré-existantes
**Scope** : `App.tsx`, `KPIStrip.tsx`, `CreditNoteModal.tsx`,
`ReservationDetailsModal.tsx`, `BulkUpdateModal.tsx`
**Problème actuel** : ~15 erreurs TS non bloquantes en mode strict.
**Cible** : Build `tsc --noEmit` avec zéro erreur.
**Effort estimé** : M (1–2 jours)

#### S2-011 : Suite de tests Playwright end-to-end
**Scope** : `frontend/tests/e2e/`
**Problème actuel** : Tests unitaires seulement, aucun test E2E automatisé.
**Cible** : Couvrir les 7 flux critiques définis dans le plan de test :
login, réservation, check-in, facture, paiement, check-out, décision RMS.
**Effort estimé** : L

#### S2-012 : Monitoring erreurs en production
**Scope** : Intégration Sentry ou équivalent
**Problème actuel** : Les erreurs silencieuses (`console.warn`) ne remontent
pas. Aucune visibilité sur les crashs React en production.
**Cible** : Sentry DSN configuré + alertes sur les `ok: false` Supabase
et les ErrorBoundary React.
**Effort estimé** : S

---

### P3 — Évolutions moyen terme

#### S2-013 : Apprentissage IA — exploitation des feedbacks RMS
**Scope** : `recommendationFeedback.service.ts` + nouveau moteur
**Problème actuel** : Les refus de recommandations sont loggés mais
non exploités par le moteur RMS.
**Cible** : Le moteur ajuste les coefficients de recommandation en
fonction des décisions historiques (refus avec motif).
**Effort estimé** : XL (sprint dédié)

#### S2-014 : Pricing dynamique temps réel (demand sensing)
**Scope** : `rmsEngine.ts` + `centralPricingEngine.service.ts`
**Problème actuel** : Les recommandations utilisent les données Lighthouse J-1.
**Cible** : Intégration d'un signal de demande en temps réel
(pick-up, recherches, pace) pour recalcul intraday.
**Effort estimé** : XL

#### S2-015 : Application mobile (PWA ou React Native)
**Scope** : Nouveau projet ou configuration PWA
**Cible** : Housekeeping sur mobile pour les agents d'étage.
**Effort estimé** : XL

---

## Séquence recommandée

```
Semaine 1–2   S2-009 · S2-010 · S2-003 (dette technique bloquante)
Semaine 3–4   S2-004 · S2-001 (Channel Manager — tests en sandbox)
Semaine 5–6   S2-002 · S2-006 (flux OTA + clôture)
Semaine 7–8   S2-007 · S2-008 (compta + multi-hôtel)
Semaine 9–10  S2-011 · S2-012 (qualité + monitoring)
Sprint 3+     S2-005 · S2-013 · S2-014 · S2-015
```

---

## Risques identifiés pour Sprint 2

| Risque | Impact | Mitigation |
|--------|--------|-----------|
| Accréditations API OTA (Booking/Expedia) — délai 4–8 semaines | Élevé | Anticiper les demandes dès J+1 pilote |
| Volume de données multi-hôtel → performances Supabase | Moyen | Tester avec 5 hôtels en staging avant prod |
| Régression RMS après remplacement formule DayDetailPanel | Faible | Couvrir par tests unitaires avant merge |
| Migration TypeScript strict → breaking changes | Moyen | Corriger fichier par fichier, pas en bloc |

---

*Roadmap générée le 01/06/2026 — à réviser après retour pilote Folkestone J+30.*
