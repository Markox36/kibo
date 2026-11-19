import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { calendarsApi, importIcsFile, type CalendarDto } from '../lib/entities-api';

const KEY = ['calendars'] as const;
const EVENTS_KEY = ['events'] as const;

export function useCalendars() {
  return useQuery({ queryKey: KEY, queryFn: calendarsApi.list });
}

export function useCreateCalendar() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { name: string; color: string; isDefault?: boolean }) =>
      calendarsApi.create(input),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}

export function useUpdateCalendar() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...body }: { id: string } & Partial<CalendarDto>) =>
      calendarsApi.update(id, body),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}

export function useImportIcsFile() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (args: { file: File; name?: string; color?: string }) =>
      importIcsFile(args.file, { name: args.name, color: args.color }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: KEY });
      qc.invalidateQueries({ queryKey: EVENTS_KEY });
    },
  });
}

export function useImportIcsUrl() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { url: string; name?: string; color?: string }) =>
      calendarsApi.importIcsUrl(body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: KEY });
      qc.invalidateQueries({ queryKey: EVENTS_KEY });
    },
  });
}

export function useSyncCalendar() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => calendarsApi.sync(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: KEY });
      qc.invalidateQueries({ queryKey: EVENTS_KEY });
    },
  });
}

export function useGoogleImportStatus() {
  return useQuery({
    queryKey: ['google-import-status'],
    queryFn: calendarsApi.googleStatus,
  });
}

export function useStartGoogleImport() {
  return useMutation({
    mutationFn: (body: { name?: string; color?: string }) => calendarsApi.googleStart(body),
  });
}
