import { QueryClient } from '@tanstack/react-query';

// Single shared client for the app. Mirrors the desktop defaults:
// data is considered fresh briefly, and we retry once on transient failures.
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});
