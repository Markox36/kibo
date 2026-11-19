import { useQuery } from '@tanstack/react-query';
import { adminApi, flagsApi } from '../lib/entities-api';

const PUBLIC_KEY = ['flags', 'public'] as const;

export function usePublicFlags() {
  return useQuery({
    queryKey: PUBLIC_KEY,
    queryFn: flagsApi.publicFlags,
    staleTime: 15_000,
  });
}

export function useAdminMe() {
  return useQuery({
    queryKey: ['admin', 'me'],
    queryFn: adminApi.me,
    retry: false,
  });
}
