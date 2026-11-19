import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { calendarsApi, type CalendarDto } from '../lib/entities-api';

const KEY = ['calendars'] as const;

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

export function useDeleteCalendar() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => calendarsApi.remove(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}
