import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  listCompanies,
  saveCompany,
  deleteCompany,
} from './crm.service';
import {
  listLoyaltyTiers,
  saveLoyaltyTier,
  recomputeLoyalty,
  getSegmentOverview,
} from './loyalty.service';
import {
  flagGuest,
  addIncident,
  listIncidents,
  getSatisfactionOverview,
  type GuestFlagInput,
} from './risk.service';
import { useGuests } from '@/src/domains/guests/hooks';

// ─── Companies (Wave C3) ──────────────────────────────────────────────────────

export function useCompanies() {
  return useQuery({
    queryKey: ['companies'],
    queryFn: listCompanies,
    staleTime: 30_000,
  });
}

export function useSaveCompany() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: saveCompany,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['companies'] }),
  });
}

export function useDeleteCompany() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: deleteCompany,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['companies'] }),
  });
}

// ─── Loyalty & segmentation (Wave C4) ─────────────────────────────────────────

export function useLoyaltyTiers() {
  return useQuery({
    queryKey: ['loyalty-tiers'],
    queryFn: listLoyaltyTiers,
    staleTime: 60_000,
  });
}

export function useSaveLoyaltyTier() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: saveLoyaltyTier,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['loyalty-tiers'] }),
  });
}

export function useRecomputeLoyalty() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: recomputeLoyalty,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['loyalty-tiers'] });
      qc.invalidateQueries({ queryKey: ['segment-overview'] });
      qc.invalidateQueries({ queryKey: ['guests'] });
    },
  });
}

export function useSegmentOverview() {
  return useQuery({
    queryKey: ['segment-overview'],
    queryFn: getSegmentOverview,
    staleTime: 30_000,
  });
}

// ─── Risk & satisfaction (Wave C5) ────────────────────────────────────────────

export function useBlacklistedGuests() {
  return useGuests({ blacklisted: true, limit: 200 });
}

export function useRiskyGuests() {
  return useGuests({ riskLevels: ['medium', 'high', 'critical'], limit: 200 });
}

export function useFlagGuest() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: GuestFlagInput) => flagGuest(input),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['guests'] });
      qc.invalidateQueries({ queryKey: ['segment-overview'] });
    },
  });
}

export function useAddIncident(guestId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (params: { type: string; description: string; incident_date: string }) =>
      addIncident({ guest_id: guestId, ...params }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['incidents', guestId] });
      qc.invalidateQueries({ queryKey: ['guests'] });
    },
  });
}

export function useGuestIncidents(guestId: string | null) {
  return useQuery({
    queryKey: ['incidents', guestId],
    queryFn: () => listIncidents(guestId as string),
    enabled: !!guestId,
    staleTime: 30_000,
  });
}

export function useSatisfactionOverview() {
  return useQuery({
    queryKey: ['satisfaction-overview'],
    queryFn: getSatisfactionOverview,
    staleTime: 30_000,
  });
}
