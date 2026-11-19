import { z } from 'zod';

export const TaskStatus = z.enum([
  'inbox',
  'pending',
  'in_progress',
  'blocked',
  'done',
  'cancelled',
]);
export type TaskStatus = z.infer<typeof TaskStatus>;

export const Priority = z.enum(['low', 'medium', 'high']);
export type Priority = z.infer<typeof Priority>;

export const Energy = z.enum(['low', 'medium', 'high']);
export type Energy = z.infer<typeof Energy>;

export const TimeBlock = z.enum(['morning', 'afternoon', 'night']);
export type TimeBlock = z.infer<typeof TimeBlock>;

export const Recurrence = z.enum(['none', 'daily', 'weekly', 'monthly']);
export type Recurrence = z.infer<typeof Recurrence>;

export const Reminder = z.enum([
  'none',
  'at_time',
  '5m_before',
  '15m_before',
  '1h_before',
  '1d_before',
]);
export type Reminder = z.infer<typeof Reminder>;

export const SyncStatus = z.enum([
  'synced',
  'pending_create',
  'pending_update',
  'pending_delete',
  'conflict',
  'error',
]);
export type SyncStatus = z.infer<typeof SyncStatus>;

export const InboxType = z.enum(['task', 'event', 'note', 'idea']);
export type InboxType = z.infer<typeof InboxType>;

export const InboxItemStatus = z.enum(['pending', 'processed', 'archived']);
export type InboxItemStatus = z.infer<typeof InboxItemStatus>;

export const CalendarType = z.enum(['internal', 'ics_file', 'ics_url']);
export type CalendarType = z.infer<typeof CalendarType>;

export const SyncOperation = z.enum(['create', 'update', 'delete']);
export type SyncOperation = z.infer<typeof SyncOperation>;

export const TimeEntryType = z.enum(['stopwatch', 'pomodoro']);
export type TimeEntryType = z.infer<typeof TimeEntryType>;

export const DevicePlatform = z.enum(['desktop', 'web', 'mobile']);
export type DevicePlatform = z.infer<typeof DevicePlatform>;

export const AccentColor = z.enum(['blue', 'violet', 'green', 'orange']);
export type AccentColor = z.infer<typeof AccentColor>;

export const ThemeMode = z.enum(['dark', 'light', 'system']);
export type ThemeMode = z.infer<typeof ThemeMode>;
