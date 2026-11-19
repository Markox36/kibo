import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';

export interface InboxItemDto {
  id: string;
  workspaceId: string;
  text: string;
  type?: string | null;
  status: 'pending' | 'processed' | 'archived';
  categoryId?: string | null;
  tagIds: string[];
  createdAt: string;
  updatedAt: string;
  version: number;
}

const KEY = ['inbox'] as const;

export function useInbox() {
  return useQuery({ queryKey: KEY, queryFn: () => api.get<InboxItemDto[]>('/inbox') });
}

export function useCreateInbox() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { text: string; type?: string | null }) =>
      api.post<InboxItemDto>('/inbox', input),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}

export function useUpdateInbox() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...body }: { id: string } & Partial<InboxItemDto>) =>
      api.patch<InboxItemDto>(`/inbox/${id}`, body),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}

export function useDeleteInbox() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete<void>(`/inbox/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}
