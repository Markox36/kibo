import { invoke } from '@tauri-apps/api/core';

export interface TaskRow {
  id: string;
  workspace_id: string;
  title: string;
  description?: string | null;
  status: string;
  priority: string;
  energy?: string | null;
  category_id?: string | null;
  tag_ids: string[];
  planned_date?: string | null;
  planned_start?: string | null;
  planned_end?: string | null;
  time_block?: string | null;
  due_date?: string | null;
  estimated_minutes?: number | null;
  recurrence: string;
  reminder: string;
  subtasks: unknown[];
  created_at: string;
  updated_at: string;
  version: number;
  sync_status: string;
}

export interface EventRow {
  id: string;
  workspace_id: string;
  calendar_id: string;
  title: string;
  description?: string | null;
  start: string;
  end: string;
  all_day: boolean;
  category_id?: string | null;
  tag_ids: string[];
  reminder: string;
  location?: string | null;
  created_at: string;
  updated_at: string;
  version: number;
  sync_status: string;
}

export interface CalendarRow {
  id: string;
  workspace_id: string;
  name: string;
  color: string;
  visible: boolean;
  type: string;
  is_default: boolean;
  created_at: string;
  updated_at: string;
  version: number;
  sync_status: string;
}

export interface SyncStatus {
  authenticated: boolean;
  last_sync_at: string | null;
  cursor: string | null;
  pending_count: number;
}

export interface SyncResult {
  uploaded: number;
  downloaded: number;
  conflicts: number;
  cursor: string | null;
  full_resync: boolean;
}

export const tauriApi = {
  // meta
  getMeta: (key: string) => invoke<string | null>('get_meta', { key }),
  setMeta: (key: string, value: string) => invoke<void>('set_meta', { key, value }),

  // tasks
  listTasks: (workspaceId: string) => invoke<TaskRow[]>('list_tasks', { workspaceId }),
  createTask: (input: {
    workspace_id: string;
    title: string;
    priority?: string;
    planned_date?: string | null;
    due_date?: string | null;
  }) => invoke<TaskRow>('create_task', { input }),
  updateTask: (id: string, input: Record<string, unknown>) =>
    invoke<TaskRow>('update_task', { id, input }),
  deleteTask: (id: string) => invoke<void>('delete_task', { id }),

  // events
  listEvents: (workspaceId: string) => invoke<EventRow[]>('list_events', { workspaceId }),
  createEvent: (input: {
    workspace_id: string;
    calendar_id: string;
    title: string;
    start: string;
    end: string;
    all_day?: boolean;
  }) => invoke<EventRow>('create_event', { input }),
  updateEvent: (id: string, input: Record<string, unknown>) =>
    invoke<EventRow>('update_event', { id, input }),
  deleteEvent: (id: string) => invoke<void>('delete_event', { id }),

  // calendars
  listCalendars: (workspaceId: string) => invoke<CalendarRow[]>('list_calendars', { workspaceId }),
  createCalendar: (input: {
    workspace_id: string;
    name: string;
    color: string;
    is_default?: boolean;
  }) => invoke<CalendarRow>('create_calendar', { input }),

  // inbox
  listInbox: (workspaceId: string) => invoke<unknown[]>('list_inbox', { workspaceId }),
  createInbox: (input: { workspace_id: string; text: string }) =>
    invoke<unknown>('create_inbox', { input }),

  // sync
  setCredentials: (args: {
    apiUrl: string;
    accessToken: string;
    refreshToken: string;
    workspaceId: string;
  }) => invoke<void>('set_credentials', args),
  clearCredentials: () => invoke<void>('clear_credentials'),
  syncNow: () => invoke<SyncResult>('sync_now'),
  getSyncStatus: () => invoke<SyncStatus>('get_sync_status'),

  // backup
  exportBackup: (path: string) => invoke<unknown>('export_backup', { path }),
  importBackup: (path: string) => invoke<unknown>('import_backup', { path }),
  exportCsv: (workspaceId: string, entityType: string, path: string) =>
    invoke<{ path: string; rows: number; entity_type: string }>('export_csv', {
      workspaceId,
      entityType,
      path,
    }),

  // notifications
  notifyTest: (title: string, body: string) =>
    invoke<void>('notify_test', { title, body }),
  remindersRescan: () => invoke<void>('reminders_rescan'),

  // trash
  listTrash: (workspaceId: string) =>
    invoke<TrashItem[]>('list_trash', { workspaceId }),
  restoreEntity: (entityType: TrashEntity, id: string) =>
    invoke<void>('restore_entity', { entityType, id }),
  purgeEntity: (entityType: TrashEntity, id: string) =>
    invoke<void>('purge_entity', { entityType, id }),
  emptyTrash: (workspaceId: string) =>
    invoke<number>('empty_trash', { workspaceId }),
  purgeOlderThan: (workspaceId: string, days: number) =>
    invoke<number>('purge_older_than', { workspaceId, days }),

  // ics
  exportIcs: (workspaceId: string, path: string) =>
    invoke<{ path: string; count: number }>('export_ics', { workspaceId, path }),
  importIcs: (workspaceId: string, calendarId: string, path: string) =>
    invoke<{ imported: number; skipped: number; calendar_id: string }>(
      'import_ics',
      { workspaceId, calendarId, path },
    ),

  // encrypted backup
  exportBackupEncrypted: (path: string, passphrase: string) =>
    invoke<{ path: string; bytes: number }>('export_backup_encrypted', {
      path,
      passphrase,
    }),
  importBackupEncrypted: (path: string, passphrase: string) =>
    invoke<unknown>('import_backup_encrypted', { path, passphrase }),

  // google oauth
  googleOauthLogin: (clientId: string, clientSecret?: string) =>
    invoke<string>('google_oauth_login', { clientId, clientSecret }),
  openExternalUrl: (url: string) => invoke<void>('open_external_url', { url }),
};

export type TrashEntity = 'task' | 'event' | 'inbox' | 'calendar' | 'category';

export interface TrashItem {
  entity_type: TrashEntity;
  id: string;
  workspace_id: string;
  title: string;
  deleted_at: string;
  updated_at: string;
}

export interface NotificationFiredPayload {
  entity_type: 'event' | 'task';
  entity_id: string;
  title: string;
  body: string;
  anchor_at: string;
  reminder: string;
}
