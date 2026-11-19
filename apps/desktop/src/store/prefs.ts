import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { tauriApi } from '../lib/tauri-api';

export interface PomodoroPreset {
  workMin: number;
  shortBreakMin: number;
  longBreakMin: number;
  cyclesBeforeLong: number;
}

export const ZOOM_MIN = 0.7;
export const ZOOM_MAX = 1.6;
export const ZOOM_STEP = 0.1;
export const ZOOM_DEFAULT = 1.0;

export interface WorkingHours {
  start: string;
  end: string;
  workOnWeekends: boolean;
}

export interface PrefsState {
  notificationsEnabled: boolean;
  reminderLeadMinutes: number;
  notifyEvents: boolean;
  notifyTaskDue: boolean;
  notifyTaskPlanned: boolean;

  pomodoro: PomodoroPreset;
  customTimer: { workMin: number; breakMin: number };

  zoom: number;

  workingHours: WorkingHours;

  set: (patch: Partial<Omit<PrefsState, 'set' | 'setPomodoro' | 'setCustomTimer' | 'setZoom' | 'zoomIn' | 'zoomOut' | 'zoomReset' | 'setWorkingHours'>>) => void;
  setPomodoro: (p: Partial<PomodoroPreset>) => void;
  setCustomTimer: (p: Partial<{ workMin: number; breakMin: number }>) => void;
  setZoom: (z: number) => void;
  zoomIn: () => void;
  zoomOut: () => void;
  zoomReset: () => void;
  setWorkingHours: (p: Partial<WorkingHours>) => void;
}

function clampZoom(z: number): number {
  if (!Number.isFinite(z)) return ZOOM_DEFAULT;
  const rounded = Math.round(z * 100) / 100;
  return Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, rounded));
}

const NOTIF_META_KEY = 'notification_prefs';

interface NotifRustPrefs {
  notifications_enabled: boolean;
  notify_events: boolean;
  notify_task_planned: boolean;
  notify_task_due: boolean;
  reminder_lead_minutes: number;
}

function toRustPrefs(s: Pick<PrefsState, 'notificationsEnabled' | 'notifyEvents' | 'notifyTaskPlanned' | 'notifyTaskDue' | 'reminderLeadMinutes'>): NotifRustPrefs {
  return {
    notifications_enabled: s.notificationsEnabled,
    notify_events: s.notifyEvents,
    notify_task_planned: s.notifyTaskPlanned,
    notify_task_due: s.notifyTaskDue,
    reminder_lead_minutes: s.reminderLeadMinutes,
  };
}

function pushToRust(s: PrefsState): void {
  tauriApi.setMeta(NOTIF_META_KEY, JSON.stringify(toRustPrefs(s))).catch(() => {
    // ignore — backend may not be ready yet during startup
  });
}

export const usePrefs = create<PrefsState>()(
  persist(
    (set) => ({
      notificationsEnabled: false,
      reminderLeadMinutes: 10,
      notifyEvents: true,
      notifyTaskDue: true,
      notifyTaskPlanned: true,

      pomodoro: { workMin: 25, shortBreakMin: 5, longBreakMin: 15, cyclesBeforeLong: 4 },
      customTimer: { workMin: 50, breakMin: 10 },

      zoom: ZOOM_DEFAULT,

      workingHours: { start: '09:00', end: '18:00', workOnWeekends: false },

      set: (patch) => set(patch),
      setPomodoro: (p) => set((s) => ({ pomodoro: { ...s.pomodoro, ...p } })),
      setCustomTimer: (p) => set((s) => ({ customTimer: { ...s.customTimer, ...p } })),
      setZoom: (z) => set({ zoom: clampZoom(z) }),
      zoomIn: () => set((s) => ({ zoom: clampZoom(s.zoom + ZOOM_STEP) })),
      zoomOut: () => set((s) => ({ zoom: clampZoom(s.zoom - ZOOM_STEP) })),
      zoomReset: () => set({ zoom: ZOOM_DEFAULT }),
      setWorkingHours: (p) => set((s) => ({ workingHours: { ...s.workingHours, ...p } })),
    }),
    { name: 'kibo-prefs' },
  ),
);

let lastPushed = '';
usePrefs.subscribe((s) => {
  const key = JSON.stringify(toRustPrefs(s));
  if (key !== lastPushed) {
    lastPushed = key;
    pushToRust(s);
  }
});
pushToRust(usePrefs.getState());
