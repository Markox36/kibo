// Focus/pomodoro session state, ported from the web store with AsyncStorage
// persistence so an in-progress session survives app restarts.
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

export type FocusMode = 'pomodoro' | 'custom' | 'stopwatch';
export type FocusPhase = 'idle' | 'work' | 'short_break' | 'long_break';

export interface PhasePlan {
  workMin: number;
  shortBreakMin: number;
  longBreakMin: number;
  cyclesBeforeLong: number;
}

export interface SessionPayload {
  taskId: string | null;
  startedAt: string;
  endedAt: string;
  durationSeconds: number;
  mode: FocusMode;
}

export interface FocusState {
  mode: FocusMode;
  phase: FocusPhase;
  endsAt: number | null;
  remainingMs: number | null;
  paused: boolean;
  cyclesCompleted: number;
  plan: PhasePlan;
  taskId: string | null;
  sessionStartedAt: number | null;
  stopwatchStartedAt: number | null;

  start: (mode: FocusMode, plan: PhasePlan, taskId?: string | null) => void;
  pause: () => void;
  resume: () => void;
  stop: () => SessionPayload | null;
  skipPhase: () => void;
  tick: (now: number) => FocusPhase | null;
  setTaskId: (taskId: string | null) => void;
}

const DEFAULT_PLAN: PhasePlan = {
  workMin: 25,
  shortBreakMin: 5,
  longBreakMin: 15,
  cyclesBeforeLong: 4,
};

function nextPhaseAfterWork(cyclesCompleted: number, plan: PhasePlan): 'short_break' | 'long_break' {
  return (cyclesCompleted + 1) % plan.cyclesBeforeLong === 0 ? 'long_break' : 'short_break';
}

function phaseDurationMs(phase: FocusPhase, plan: PhasePlan): number {
  switch (phase) {
    case 'work':
      return plan.workMin * 60_000;
    case 'short_break':
      return plan.shortBreakMin * 60_000;
    case 'long_break':
      return plan.longBreakMin * 60_000;
    default:
      return 0;
  }
}

export const useFocus = create<FocusState>()(
  persist(
    (set, get) => ({
      mode: 'pomodoro',
      phase: 'idle',
      endsAt: null,
      remainingMs: null,
      paused: false,
      cyclesCompleted: 0,
      plan: DEFAULT_PLAN,
      taskId: null,
      sessionStartedAt: null,
      stopwatchStartedAt: null,

      start: (mode, plan, taskId = null) => {
        const now = Date.now();
        if (mode === 'stopwatch') {
          set({
            mode,
            plan,
            phase: 'work',
            endsAt: null,
            remainingMs: null,
            paused: false,
            cyclesCompleted: 0,
            taskId,
            sessionStartedAt: now,
            stopwatchStartedAt: now,
          });
          return;
        }
        set({
          mode,
          plan,
          phase: 'work',
          endsAt: now + plan.workMin * 60_000,
          remainingMs: null,
          paused: false,
          cyclesCompleted: 0,
          taskId,
          sessionStartedAt: now,
          stopwatchStartedAt: null,
        });
      },

      pause: () => {
        const { endsAt, paused, mode } = get();
        if (paused) return;
        if (mode === 'stopwatch') {
          const { stopwatchStartedAt } = get();
          if (stopwatchStartedAt == null) return;
          set({
            paused: true,
            remainingMs: Date.now() - stopwatchStartedAt,
            stopwatchStartedAt: null,
          });
          return;
        }
        if (endsAt == null) return;
        set({ paused: true, remainingMs: Math.max(0, endsAt - Date.now()), endsAt: null });
      },

      resume: () => {
        const { remainingMs, paused, mode } = get();
        if (!paused || remainingMs == null) return;
        if (mode === 'stopwatch') {
          set({ paused: false, stopwatchStartedAt: Date.now() - remainingMs, remainingMs: null });
          return;
        }
        set({ paused: false, endsAt: Date.now() + remainingMs, remainingMs: null });
      },

      stop: () => {
        const { taskId, sessionStartedAt, mode } = get();
        let payload: SessionPayload | null = null;
        if (sessionStartedAt != null) {
          const endedAt = Date.now();
          const durationSeconds = Math.max(0, Math.floor((endedAt - sessionStartedAt) / 1000));
          payload = {
            taskId,
            startedAt: new Date(sessionStartedAt).toISOString(),
            endedAt: new Date(endedAt).toISOString(),
            durationSeconds,
            mode,
          };
        }
        set({
          phase: 'idle',
          endsAt: null,
          remainingMs: null,
          paused: false,
          cyclesCompleted: 0,
          taskId: null,
          sessionStartedAt: null,
          stopwatchStartedAt: null,
        });
        return payload;
      },

      skipPhase: () => {
        const { phase, cyclesCompleted, plan, mode } = get();
        if (phase === 'idle' || mode === 'stopwatch') return;
        let nextPhase: FocusPhase;
        let cycles = cyclesCompleted;
        if (phase === 'work') {
          cycles = cyclesCompleted + 1;
          nextPhase = nextPhaseAfterWork(cyclesCompleted, plan);
        } else {
          nextPhase = 'work';
        }
        set({
          phase: nextPhase,
          cyclesCompleted: cycles,
          endsAt: Date.now() + phaseDurationMs(nextPhase, plan),
          remainingMs: null,
          paused: false,
        });
      },

      tick: (now) => {
        const { endsAt, phase, paused, plan, cyclesCompleted, mode } = get();
        if (mode === 'stopwatch') return null;
        if (paused || endsAt == null || phase === 'idle') return null;
        if (now < endsAt) return null;
        let nextPhase: FocusPhase;
        let cycles = cyclesCompleted;
        if (phase === 'work') {
          cycles = cyclesCompleted + 1;
          nextPhase = nextPhaseAfterWork(cyclesCompleted, plan);
        } else {
          nextPhase = 'work';
        }
        set({
          phase: nextPhase,
          cyclesCompleted: cycles,
          endsAt: now + phaseDurationMs(nextPhase, plan),
        });
        return nextPhase;
      },

      setTaskId: (taskId) => set({ taskId }),
    }),
    {
      name: 'kibo.focus',
      storage: createJSONStorage(() => AsyncStorage),
    },
  ),
);

export function currentRemainingMs(state: FocusState, now: number = Date.now()): number {
  if (state.phase === 'idle') return 0;
  if (state.mode === 'stopwatch') {
    if (state.paused) return state.remainingMs ?? 0;
    if (state.stopwatchStartedAt == null) return 0;
    return Math.max(0, now - state.stopwatchStartedAt);
  }
  if (state.paused) return state.remainingMs ?? 0;
  if (state.endsAt == null) return 0;
  return Math.max(0, state.endsAt - now);
}

export function phaseLabel(phase: FocusPhase): string {
  switch (phase) {
    case 'work':
      return 'Concentración';
    case 'short_break':
      return 'Descanso corto';
    case 'long_break':
      return 'Descanso largo';
    default:
      return 'Sin sesión';
  }
}

export function formatMs(ms: number): string {
  const total = Math.floor(ms / 1000);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}
