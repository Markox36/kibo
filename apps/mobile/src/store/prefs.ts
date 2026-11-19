import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

export interface PomodoroPreset {
  workMin: number;
  shortBreakMin: number;
  longBreakMin: number;
  cyclesBeforeLong: number;
}

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
  workingHours: WorkingHours;
  calendarView: 'month' | 'week' | 'day' | 'agenda';
  set: (
    patch: Partial<
      Omit<PrefsState, 'set' | 'setPomodoro' | 'setCustomTimer' | 'setWorkingHours'>
    >,
  ) => void;
  setPomodoro: (p: Partial<PomodoroPreset>) => void;
  setCustomTimer: (p: Partial<{ workMin: number; breakMin: number }>) => void;
  setWorkingHours: (p: Partial<WorkingHours>) => void;
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
      workingHours: { start: '09:00', end: '18:00', workOnWeekends: false },
      calendarView: 'month',
      set: (patch) => set(patch),
      setPomodoro: (p) => set((s) => ({ pomodoro: { ...s.pomodoro, ...p } })),
      setCustomTimer: (p) => set((s) => ({ customTimer: { ...s.customTimer, ...p } })),
      setWorkingHours: (p) => set((s) => ({ workingHours: { ...s.workingHours, ...p } })),
    }),
    {
      name: 'kibo.prefs',
      storage: createJSONStorage(() => AsyncStorage),
    },
  ),
);
