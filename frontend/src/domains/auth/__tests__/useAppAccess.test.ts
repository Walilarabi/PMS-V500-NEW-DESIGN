import { describe, it, expect, vi } from 'vitest';

// useAppAccess.ts importe le client supabase au niveau module (qui throw sans
// variables d'env). On le stub : resolveHasPms est une fonction pure.
vi.mock('@/src/lib/supabase', () => ({ supabase: {} }));
vi.mock('@/src/domains/auth/AuthContext', () => ({ useAuth: () => ({ session: null }) }));

import { resolveHasPms } from '../useAppAccess';

const PMS = 'app-pms';
const RH = 'app-rh';
const HOTEL = 'hotel-1';

describe('resolveHasPms — enforcement applicatif PMS par hôtel actif', () => {
  it('pas d\'hôtel actif → autorisé (la garde hôtel/RLS s\'applique ailleurs)', () => {
    expect(resolveHasPms({ tenantId: null, appIds: [], pmsId: PMS })).toBe(true);
  });

  it('erreur réseau → fail-open (jamais de white-screen)', () => {
    expect(resolveHasPms({ tenantId: HOTEL, appIds: [RH], pmsId: PMS, isError: true })).toBe(true);
  });

  it('app PMS inconnue côté catalogue → autorisé', () => {
    expect(resolveHasPms({ tenantId: HOTEL, appIds: [RH], pmsId: null })).toBe(true);
  });

  it('hôtel non configuré (aucune ligne) → legacy → autorisé', () => {
    expect(resolveHasPms({ tenantId: HOTEL, appIds: [], pmsId: PMS })).toBe(true);
  });

  it('utilisateur AVEC accès PMS pour l\'hôtel → autorisé', () => {
    expect(resolveHasPms({ tenantId: HOTEL, appIds: [PMS, RH], pmsId: PMS })).toBe(true);
  });

  it('utilisateur SANS accès PMS (config présente, PMS exclu) → refusé', () => {
    expect(resolveHasPms({ tenantId: HOTEL, appIds: [RH], pmsId: PMS })).toBe(false);
  });

  it('accès direct (URL) à l\'hôtel sans grant PMS → refusé', () => {
    // Même décision quelle que soit la page demandée : la garde est au niveau du shell.
    expect(resolveHasPms({ tenantId: 'hotel-x', appIds: [RH], pmsId: PMS })).toBe(false);
  });
});
