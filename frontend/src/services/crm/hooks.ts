import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  listCompanies,
  saveCompany,
  deleteCompany,
} from './crm.service';

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
