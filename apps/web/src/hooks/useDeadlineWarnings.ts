import { useMemo } from 'react';
import { computeDeadlineWarnings, type DeadlineWarning } from '@kibo/planning';
import { useEvents } from './useEvents';
import { useTasks } from './useTasks';
import { usePrefs } from '../store/prefs';

export function useDeadlineWarnings(): DeadlineWarning[] {
  const events = useEvents();
  const tasks = useTasks();
  const wh = usePrefs((s) => s.workingHours);
  return useMemo(
    () =>
      computeDeadlineWarnings(
        (tasks.data ?? []).map((t) => ({
          id: t.id,
          title: t.title,
          status: t.status,
          plannedDate: t.plannedDate,
          plannedStart: t.plannedStart,
          plannedEnd: t.plannedEnd,
          dueDate: t.dueDate,
          estimatedMinutes: t.estimatedMinutes,
        })),
        events.data ?? [],
        wh,
      ),
    [events.data, tasks.data, wh],
  );
}
