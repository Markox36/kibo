import { useMemo } from 'react';
import { computeDailyLoad, type DailyLoad } from '@kibo/planning';
import { useEvents } from './useEvents';
import { useTasks } from './useTasks';
import { usePrefs } from '../store/prefs';

export function useDailyLoads(dates: Date[]): Map<string, DailyLoad> {
  const events = useEvents();
  const tasks = useTasks();
  const wh = usePrefs((s) => s.workingHours);
  return useMemo(() => {
    const evts = events.data ?? [];
    const tks = tasks.data ?? [];
    const out = new Map<string, DailyLoad>();
    for (const d of dates) {
      const load = computeDailyLoad(d, evts, tks, wh);
      out.set(load.date, load);
    }
    return out;
  }, [dates, events.data, tasks.data, wh]);
}

export function useDailyLoad(date: Date): DailyLoad {
  const events = useEvents();
  const tasks = useTasks();
  const wh = usePrefs((s) => s.workingHours);
  return useMemo(
    () => computeDailyLoad(date, events.data ?? [], tasks.data ?? [], wh),
    [date, events.data, tasks.data, wh],
  );
}
