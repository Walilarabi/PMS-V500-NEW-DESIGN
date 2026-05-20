# FLOWTYM PMS — Contexte projet pour Claude Code

## Identité

FLOWTYM PMS est un PMS hôtelier SaaS enterprise-grade : mission-critical, temps réel, multi-tenant, event-driven, API-first, fortement typé, production réelle (pas démo).

Hôtel pilote : **Folkestone Opéra** (Paris, 45 chambres)
Cible commerciale : 5 prospects, positionnement entre Duetto et Atomize, pitch dans 2 mois.

## Stack technique

- Frontend : React 18 + TypeScript + Vite 6 + TailwindCSS + Zustand + TanStack Query + Recharts
- Backend : Supabase (Postgres + Auth + Realtime + RLS)
- Deploy : Vercel (auto-deploy sur push main)

## IDs critiques

- Supabase project_id : `hzrzkvdebaadditvbqis`
- Hotel Folkestone Opéra id : `02b9eb0e-89ef-45de-ba8e-20d4b41c500c`
- Vercel team : `team_Xqzv4bPlX6Pp7zmcO7Nq2AqN`
- Vercel project : `prj_qdKHUJkjz3YfDJYFdfD5HtAUEc7g`
- Repo GitHub : `Walilarabi/PMS-V500-NEW-DESIGN`

## Règles d'or non négociables

1. Aucune donnée mockée — toujours données réelles
2. Multi-tenant strict — filtrer par hotel_id, RLS respectée
3. Pas de TypeScript `any`
4. Append-only audit sur tables sensibles
5. Architecte avant générateur de code
6. Toujours `npm run build` AVANT chaque push
7. Commits atomiques, messages conventionnels (feat:, fix:, refactor:)

## Architecture modules clés

### Module Revenue Management (le cœur)
- `frontend/src/pages/revenue/RMSTableauPro.tsx` — tableau RMS (23 colonnes)
- `frontend/src/pages/revenue/LighthouseMonthlyView.tsx` — Veille Concurrentielle (7 onglets)
- `frontend/src/pages/revenue/components/MarketAnalysisCockpit.tsx` — Cockpit RMS
- `frontend/src/pages/revenue/components/PremiumCompsetChart.tsx` — graphique compset
- `frontend/src/services/market-analysis-engine.ts` — moteur déterministe (8 règles)
- `frontend/src/services/lighthouse-parser.service.ts` — parser Lighthouse
- `frontend/src/services/expedia-parser.service.ts` — parser Expedia (ISOLÉ, pas branché)
- `frontend/src/services/salons-parser.service.ts` — parser Salons
- `frontend/src/components/shared/EventTooltip.tsx` — tooltip réutilisable

### Stores Zustand (persistance localStorage)
- `useLighthouseStore` — données Lighthouse actives
- `useSalonsStore` — événements salons
- `useRateCalendarStore` — calendrier tarifaire
- (à créer) `useExpediaStore` — données Expedia

### Tables Supabase critiques
- `lighthouse_imports` + `lighthouse_days` — snapshots Lighthouse versionnés
- `salon_events` — événements salons (append-only)
- `rms_events` — ⚠️ pas de hotel_id, table orpheline (à corriger en Palier C)
- `planning_events` — événements planning manuel
- `rms_decisions` — audit log append-only (anti-UPDATE/DELETE triggers)
- `rms_settings` — markup paramétrable
- `reservations` — soft-delete via cancelled_at + no_show_at (PAS deleted_at)

## État actuel en prod (commit bb5082e du 19 mai 2026)

### ✅ Livré
- Tooltip salons riche dans RMS (EventTooltip réutilisable)
- Cockpit RMS avec onglets Recommandations + Briefing dédiés
- Bandeau Lighthouse compact repliable
- Modal Détail journalier premium
- Parser Expedia isolé (pas encore branché à l'UI)
- 8 règles déterministes du moteur RMS

### 🔧 À faire en priorité (par ordre)
1. Brancher le parser Expedia (store + bouton import + intégration RMS)
2. Comparaison temporelle dans PremiumCompsetChart (3 boutons VS Hier/3j/7j)
3. Bouton Enregistrer salons avec politique "préserve passés"
4. Synchronisation Planning ↔ RMS (lecture seule d'abord)
5. Ajout hotel_id à rms_events (faille sécurité multi-tenant)

### 🚀 Roadmap stratégique 8 semaines (post-Expedia)
4 features killer pour pitch dans 2 mois :
1. Pricing Assistant explicable ("Pourquoi pas autre chose ?")
2. Time Machine (compare snapshots Lighthouse historiques)
3. Intelligence Compset (détection patterns concurrents, nécessite 6-8 semaines d'historique)
4. Auto-Pilot safe (mode automatique nocturne avec kill switch)

### 🚫 Reporté Phase 2 post-pitch
Group Mode (multi-hôtels) — nécessite refonte multi-tenant lourde.

## Décisions à NE PAS prendre seul (demander confirmation à Walid)

- Migration DB destructive (drop column, drop table)
- Modification du moteur RMS déterministe
- Désactivation de RLS
- Changement stratégie multi-tenant
- Branchement d'API externe payante (Lighthouse, etc.)

## Workflow obligatoire

1. Lire CLAUDE.md à chaque nouvelle session
2. AVANT toute modification importante : présenter un plan, attendre validation
3. Modifier fichiers
4. `cd frontend && npm run build` — vérifier que ça compile
5. Si build vert : commit avec message conventionnel, push sur main
6. Si build rouge : montrer l'erreur, proposer fix
7. Confirmer la fin de la tâche
