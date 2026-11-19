import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { eventsApi, type EventDto } from '../lib/entities-api';

const KEY = ['events'] as const;

export function useEvents() {
  return useQuery({ queryKey: KEY, queryFn: eventsApi.list });
}

export function useCreateEvent() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (
      input: Partial<EventDto> & { title: string; calendarId: string; start: string; end: string },
    ) => eventsApi.create(input),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}

export function useUpdateEvent() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...body }: { id: string } & Partial<EventDto>) => eventsApi.update(id, body),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}

export function useDeleteEvent() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => eventsApi.remove(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}
