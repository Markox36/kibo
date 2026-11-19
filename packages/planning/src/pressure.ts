import { computeDailyLoad, toDateKey, type PlanningEvent, type PlanningTask, type WorkingHours } from './load.js';

export interface DeadlineWarning {
  taskId: string;
  taskTitle: string;
  dueDate: string;
  estimatedMinutes: number;
  freeMinutesUntilDeadline: number;
  deficitMinutes: number;
  daysUntilDeadline: number;
}

export interface PressureTask extends PlanningTask {
  id: string;
  title: string;
  status: string;
  dueDate?: string | null;
  estimatedMinutes?: number | null;
}

function daysBetween(from: Date, toDateStr: string): Date[] {
  const to = new Date(toDateStr.length === 10 ? `${toDateStr}T00:00:00` : toDateStr);
  const start = new Date(from.getFullYear(), from.getMonth(), from.getDate());
  const end = new Date(to.getFullYear(), to.getMonth(), to.getDate());
  const out: Date[] = [];
  const cur = new Date(start);
  while (cur <= end) {
    out.push(new Date(cur));
    cur.setDate(cur.getDate() + 1);
  }
  return out;
}

export function computeDeadlineWarnings(
  tasks: PressureTask[],
  events: PlanningEvent[],
  wh: WorkingHours,
  now: Date = new Date(),
  maxLookaheadDays: number = 30,
): DeadlineWarning[] {
  const warnings: DeadlineWarning[] = [];
  const todayKey = toDateKey(now);

  for (const t of tasks) {
    if (t.status === 'done' || t.status === 'cancelled') continue;
    if (!t.dueDate) continue;
    if (!t.estimatedMinutes || t.estimatedMinutes <= 0) continue;
    const dueKey = t.dueDate.slice(0, 10);
    if (dueKey < todayKey) continue;

    const days = daysBetween(now, t.dueDate);
    if (days.length === 0 || days.length > maxLookaheadDays) continue;

    const otherTasks = tasks.filter((x) => x.id !== t.id);

    let freeMinutes = 0;
    for (const d of days) {
      const load = computeDailyLoad(d, events, otherTasks, wh);
      freeMinutes += load.freeMinutes;
    }

    const deficit = t.estimatedMinutes - freeMinutes;
    if (deficit > 0) {
      warnings.push({
        taskId: t.id,
        taskTitle: t.title,
        dueDate: t.dueDate,
        estimatedMinutes: t.estimatedMinutes,
        freeMinutesUntilDeadline: freeMinutes,
        deficitMinutes: deficit,
        daysUntilDeadline: days.length - 1,
      });
    }
  }

  warnings.sort((a, b) => {
    if (a.daysUntilDeadline !== b.daysUntilDeadline) {
      return a.daysUntilDeadline - b.daysUntilDeadline;
    }
    return b.deficitMinutes - a.deficitMinutes;
  });

  return warnings;
}
