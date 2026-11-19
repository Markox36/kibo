import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { integrationsApi } from '../lib/entities-api';

const KEY = ['integrations', 'google'] as const;

export function useGoogleIntegration() {
  return useQuery({ queryKey: KEY, queryFn: integrationsApi.googleStatus });
}

export function useStartGoogleIntegration() {
  return useMutation({
    mutationFn: (body: { name?: string; color?: string }) => integrationsApi.googleStart(body),
  });
}

export function useSyncGoogleIntegration() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => integrationsApi.googleSync(),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['events'] });
      qc.invalidateQueries({ queryKey: ['calendars'] });
      qc.invalidateQueries({ queryKey: KEY });
    },
  });
}

export function useDisconnectGoogle() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => integrationsApi.googleDisconnect(),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: KEY });
    },
  });
}
