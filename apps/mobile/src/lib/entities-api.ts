import { api } from './api';

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
  create: (
    body: Partial<EventDto> & { title: string; calendarId: string; start: string; end: string },
  ) => api.post<EventDto>('/events', body),
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
};

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

export interface GoogleIntegrationStatus {
  configured: boolean;
  connected: boolean;
  email: string | null;
  linkedAt: string | null;
  calendarId: string | null;
  needsReauth: boolean;
}

export const integrationsApi = {
  googleStatus: () => api.get<GoogleIntegrationStatus>('/integrations/google'),
  googleStart: (body: { name?: string; color?: string }) =>
    api.post<{ authUrl: string }>('/integrations/google/start', body),
  googleSync: () => api.post<SyncCalendarResult>('/integrations/google/sync'),
  googleDisconnect: () => api.delete<{ revoked: boolean }>('/integrations/google'),
};
