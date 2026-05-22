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
