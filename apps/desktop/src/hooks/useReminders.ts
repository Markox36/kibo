import { useEffect, useRef } from 'react';
import { toast } from 'sonner';
import { useEvents } from './useEvents';
import { useTasks } from './useTasks';
import { usePrefs } from '../store/prefs';
import { notify, currentPermission } from '../lib/notifications';

const POLL_MS = 30_000;
const DEDUPE_KEY = 'kibo-reminded-ids';

function loadReminded(): Set<string> {
  try {
    const raw = localStorage.getItem(DEDUPE_KEY);
    if (!raw) return new Set();
    const arr = JSON.parse(raw) as string[];
    return new Set(arr);
  } catch {
    return new Set();
  }
}

function saveReminded(set: Set<string>): void {
  const arr = Array.from(set).slice(-500);
  try {
    localStorage.setItem(DEDUPE_KEY, JSON.stringify(arr));
  } catch {
    // ignore
  }
}

function fmtWhen(ms: number): string {
  if (ms <= 0) return 'ahora';
  const min = Math.round(ms / 60000);
  if (min < 60) return `en ${min} min`;
  const h = Math.floor(min / 60);
  const r = min % 60;
  return r ? `en ${h}h ${r}m` : `en ${h}h`;
}

export function useReminders(): void {
  const events = useEvents();
  const tasks = useTasks();
  const prefs = usePrefs();
  const remindedRef = useRef<Set<string>>(loadReminded());

  useEffect(() => {
    if (!prefs.notificationsEnabled) return;

    const check = () => {
      const now = Date.now();
      const lead = prefs.reminderLeadMinutes * 60_000;
      const reminded = remindedRef.current;
      const permission = currentPermission();
      const canDesktopNotify = permission === 'granted';

      if (prefs.notifyEvents) {
        for (const e of events.data ?? []) {
          if (e.allDay) continue;
          const startMs = new Date(e.start).getTime();
          const delta = startMs - now;
          if (delta <= lead && delta > -60_000) {
            const key = `event:${e.id}:${e.start}`;
            if (reminded.has(key)) continue;
            reminded.add(key);
            const title = `📅 ${e.title}`;
            const body = fmtWhen(delta);
            if (canDesktopNotify) notify({ title, body, tag: key });
            toast(title, { description: body });
          }
        }
      }

      for (const t of tasks.data ?? []) {
        if (t.status === 'done' || t.status === 'cancelled') continue;

        if (prefs.notifyTaskPlanned && t.plannedStart) {
          const startMs = new Date(t.plannedStart).getTime();
          const delta = startMs - now;
          if (delta <= lead && delta > -60_000) {
            const key = `task-planned:${t.id}:${t.plannedStart}`;
            if (!reminded.has(key)) {
              reminded.add(key);
              const title = `▶ ${t.title}`;
              const body = `Empieza ${fmtWhen(delta)}`;
              if (canDesktopNotify) notify({ title, body, tag: key });
              toast(title, { description: body });
            }
          }
        }

        if (prefs.notifyTaskDue && t.dueDate) {
          const dueMs = new Date(`${t.dueDate}T09:00:00`).getTime();
          const delta = dueMs - now;
          if (delta <= lead && delta > -60_000) {
            const key = `task-due:${t.id}:${t.dueDate}`;
            if (!reminded.has(key)) {
              reminded.add(key);
              const title = `⏰ Vence: ${t.title}`;
              const body = fmtWhen(delta);
              if (canDesktopNotify) notify({ title, body, tag: key });
              toast(title, { description: body });
            }
          }
        }
      }

      saveReminded(reminded);
    };

    check();
    const id = window.setInterval(check, POLL_MS);
    return () => window.clearInterval(id);
  }, [
    prefs.notificationsEnabled,
    prefs.reminderLeadMinutes,
    prefs.notifyEvents,
    prefs.notifyTaskDue,
    prefs.notifyTaskPlanned,
    events.data,
    tasks.data,
  ]);
}
