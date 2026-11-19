import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { timeEntriesApi, type TimeEntryDto } from '../lib/entities-api';

const KEY = ['time-entries'] as const;

export function useTimeEntries() {
  return useQuery({ queryKey: KEY, queryFn: timeEntriesApi.list });
}

export function useCreateTimeEntry() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: Parameters<typeof timeEntriesApi.create>[0]) =>
      timeEntriesApi.create(input),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}

export function useTaskTimeSpent(taskId: string | null | undefined): number {
  const entries = useTimeEntries();
  if (!taskId) return 0;
  return (entries.data ?? [])
    .filter((e: TimeEntryDto) => e.taskId === taskId)
    .reduce((sum: number, e: TimeEntryDto) => sum + e.durationSeconds, 0);
}
