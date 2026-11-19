import { api } from './api';
import { API_URL } from './env';
import { useAuthStore } from '../store/auth';

export interface TaskDto {
  id: string;
  workspaceId: string;
  title: string;
  description?: string | null;
  status: string;
  priority: string;
  energy?: string | null;
  plannedDate?: string | null;
  plannedStart?: string | null;
  plannedEnd?: string | null;
  dueDate?: string | null;
  estimatedMinutes?: number | null;
  categoryId?: string | null;
  tagIds: string[];
  subtasks: Array<{ id: string; text: string; done: boolean; order: number }>;
  createdAt: string;
  updatedAt: string;
  version: number;
}

export interface EventDto {
  id: string;
  workspaceId: string;
  calendarId: string;
  title: string;
  description?: string | null;
  start: string;
  end: string;
  allDay: boolean;
  categoryId?: string | null;
  tagIds: string[];
  location?: string | null;
  externalUid?: string | null;
  rrule?: string | null;
  createdAt: string;
  updatedAt: string;
  version: number;
}

export interface CalendarDto {
  id: string;
  workspaceId: string;
  name: string;
  color: string;
  visible: boolean;
  type: string;
  externalUrl?: string | null;
  externalLastSyncAt?: string | null;
  isDefault: boolean;
  createdAt: string;
  updatedAt: string;
  version: number;
}

export interface ImportIcsResult {
  calendarId: string;
  eventsInserted: number;
  eventsSkipped: number;
}

export interface SyncCalendarResult {
  eventsInserted: number;
  eventsUpdated: number;
  eventsDeleted: number;
  eventsSkipped: number;
}

export interface TimeEntryDto {
  id: string;
  workspaceId: string;
  taskId?: string | null;
  startedAt: string;
  endedAt?: string | null;
  durationSeconds: number;
  type: 'stopwatch' | 'pomodoro';
  note?: string | null;
  createdAt: string;
  updatedAt: string;
  version: number;
}

export const timeEntriesApi = {
  list: () => api.get<TimeEntryDto[]>('/time-entries'),
  create: (body: {
    taskId?: string | null;
    startedAt: string;
    endedAt?: string | null;
    durationSeconds: number;
    type: 'stopwatch' | 'pomodoro';
    note?: string | null;
  }) => api.post<TimeEntryDto>('/time-entries', body),
  update: (id: string, body: Partial<TimeEntryDto>) =>
    api.patch<TimeEntryDto>(`/time-entries/${id}`, body),
  remove: (id: string) => api.delete<void>(`/time-entries/${id}`),
};

export const tasksApi = {
  list: () => api.get<TaskDto[]>('/tasks'),
  create: (body: Partial<TaskDto> & { title: string }) => api.post<TaskDto>('/tasks', body),
  update: (id: string, body: Partial<TaskDto>) => api.patch<TaskDto>(`/tasks/${id}`, body),
  remove: (id: string) => api.delete<void>(`/tasks/${id}`),
};

export const eventsApi = {
  list: () => api.get<EventDto[]>('/events'),
  create: (body: Partial<EventDto> & { title: string; calendarId: string; start: string; end: string }) =>
    api.post<EventDto>('/events', body),
  update: (id: string, body: Partial<EventDto>) => api.patch<EventDto>(`/events/${id}`, body),
  remove: (id: string) => api.delete<void>(`/events/${id}`),
};

export const calendarsApi = {
  list: () => api.get<CalendarDto[]>('/calendars'),
  create: (body: { name: string; color: string; isDefault?: boolean }) =>
    api.post<CalendarDto>('/calendars', body),
  update: (id: string, body: Partial<CalendarDto>) => api.patch<CalendarDto>(`/calendars/${id}`, body),
  remove: (id: string) => api.delete<void>(`/calendars/${id}`),
  sync: (id: string) => api.post<SyncCalendarResult>(`/calendars/${id}/sync`),
  importIcsUrl: (body: { url: string; name?: string; color?: string }) =>
    api.post<ImportIcsResult>('/calendars/import/ics-url', body),
  googleStatus: () => api.get<{ configured: boolean }>('/calendars/import/google/status'),
  googleStart: (body: { name?: string; color?: string }) =>
    api.post<{ authUrl: string }>('/calendars/import/google/start', body),
};

export interface GoogleIntegrationStatus {
  configured: boolean;
  connected: boolean;
  email: string | null;
  linkedAt: string | null;
  calendarId: string | null;
  needsReauth: boolean;
}

export interface BulkFilterInput {
  calendarIds?: string[];
  titleRegex?: string;
  titleCaseInsensitive?: boolean;
  from?: string;
  to?: string;
  allDayOnly?: boolean;
  timedOnly?: boolean;
  recurringOnly?: boolean;
  importedOnly?: boolean;
}

export interface BulkPreviewResult {
  count: number;
  sample: Array<{ id: string; title: string; start: string; calendarId: string; allDay: boolean }>;
}

export interface FeatureFlags {
  googleCalendarEnabled: boolean;
  icsFileImportEnabled: boolean;
  icsUrlImportEnabled: boolean;
  registrationEnabled: boolean;
  maintenanceMode: boolean;
  maintenanceMessage: string | null;
  notificationsEnabled: boolean;
  focusEnabled: boolean;
  lofiEnabled: boolean;
  bulkDeleteEnabled: boolean;
  readOnly: boolean;
}

export const flagsApi = {
  publicFlags: () => api.get<FeatureFlags>('/flags/public', { auth: false }),
};

export const adminApi = {
  me: () => api.get<{ email: string | null; id: string | null }>('/admin/me'),
  getFlags: () => api.get<{ flags: FeatureFlags; defaults: FeatureFlags }>('/admin/flags'),
  patchFlags: (patch: Partial<FeatureFlags>) =>
    api.patch<{ flags: FeatureFlags }>('/admin/flags', patch),
  resetFlags: () => api.post<{ flags: FeatureFlags }>('/admin/flags/reset'),
  stats: () =>
    api.get<{ users: number; events: number; tasks: number; calendars: number; integrations: number }>(
      '/admin/stats',
    ),
};

export const eventsBulkApi = {
  preview: (body: BulkFilterInput) => api.post<BulkPreviewResult>('/events/bulk-preview', body),
  delete: (body: BulkFilterInput) => api.post<{ deleted: number }>('/events/bulk-delete', body),
};

export const integrationsApi = {
  googleStatus: () => api.get<GoogleIntegrationStatus>('/integrations/google'),
  googleStart: (body: { name?: string; color?: string }) =>
    api.post<{ authUrl: string }>('/integrations/google/start', body),
  googleSync: () => api.post<SyncCalendarResult>('/integrations/google/sync'),
  googleDisconnect: () => api.delete<{ revoked: boolean }>('/integrations/google'),
};

export async function importIcsFile(
  file: File,
  opts?: { name?: string; color?: string },
): Promise<ImportIcsResult> {
  const token = useAuthStore.getState().accessToken;
  const form = new FormData();
  form.append('file', file, file.name);
  if (opts?.name) form.append('name', opts.name);
  if (opts?.color) form.append('color', opts.color);
  const res = await fetch(`${API_URL}/calendars/import/ics`, {
    method: 'POST',
    headers: token ? { authorization: `Bearer ${token}` } : {},
    body: form,
  });
  const text = await res.text();
  const data = text ? (JSON.parse(text) as unknown) : undefined;
  if (!res.ok) {
    const code =
      data && typeof data === 'object' && 'error' in data
        ? String((data as { error: unknown }).error)
        : 'request_failed';
    throw new Error(code);
  }
  return data as ImportIcsResult;
}
