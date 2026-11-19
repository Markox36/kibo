import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { tasksApi, type TaskDto } from '../lib/entities-api';

const KEY = ['tasks'] as const;

export function useTasks() {
  return useQuery({ queryKey: KEY, queryFn: tasksApi.list });
}

export function useCreateTask() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: Partial<TaskDto> & { title: string }) => tasksApi.create(input),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}

export function useUpdateTask() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...body }: { id: string } & Partial<TaskDto>) => tasksApi.update(id, body),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}

export function useDeleteTask() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => tasksApi.remove(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}
