export interface WorkingHours {
  start: string;
  end: string;
  workOnWeekends: boolean;
}

export interface PlanningEvent {
  start: string;
  end: string;
  allDay: boolean;
}

export interface PlanningTask {
  status: string;
  plannedDate?: string | null;
  plannedStart?: string | null;
  plannedEnd?: string | null;
  estimatedMinutes?: number | null;
}

export interface DailyLoad {
  date: string;
  totalAvailableMinutes: number;
  scheduledTaskMinutes: number;
  eventMinutes: number;
  freeMinutes: number;
  loadPercentage: number;
  isRestDay: boolean;
}

export type LoadBand = 'rest' | 'low' | 'normal' | 'heavy' | 'over';

export function classifyLoad(load: DailyLoad): LoadBand {
  if (load.isRestDay || load.totalAvailableMinutes === 0) return 'rest';
  const p = load.loadPercentage;
  if (p < 0.6) return 'low';
  if (p < 0.85) return 'normal';
  if (p < 1) return 'heavy';
  return 'over';
}

export function toDateKey(d: Date): string {
  const y = d.getFullYear();
  const m = (d.getMonth() + 1).toString().padStart(2, '0');
  const day = d.getDate().toString().padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function parseHm(hm: string): { h: number; m: number } {
  const [h, m] = hm.split(':').map((s) => parseInt(s, 10));
  return { h: h ?? 0, m: m ?? 0 };
}

function dayWindow(date: Date, wh: WorkingHours): { start: Date; end: Date; available: number } {
  const dow = date.getDay();
  const isWeekend = dow === 0 || dow === 6;
  if (isWeekend && !wh.workOnWeekends) {
    const zero = new Date(date);
    return { start: zero, end: zero, available: 0 };
  }
  const { h: sh, m: sm } = parseHm(wh.start);
  const { h: eh, m: em } = parseHm(wh.end);
  const start = new Date(date.getFullYear(), date.getMonth(), date.getDate(), sh, sm, 0, 0);
  const end = new Date(date.getFullYear(), date.getMonth(), date.getDate(), eh, em, 0, 0);
  const available = Math.max(0, (end.getTime() - start.getTime()) / 60000);
  return { start, end, available };
}

function overlapMinutes(aStart: Date, aEnd: Date, bStart: Date, bEnd: Date): number {
  const s = Math.max(aStart.getTime(), bStart.getTime());
  const e = Math.min(aEnd.getTime(), bEnd.getTime());
  return Math.max(0, (e - s) / 60000);
}

function eventMinutesInWindow(evts: PlanningEvent[], winStart: Date, winEnd: Date): number {
  let total = 0;
  for (const e of evts) {
    if (e.allDay) continue;
    const s = new Date(e.start);
    const en = new Date(e.end);
    total += overlapMinutes(s, en, winStart, winEnd);
  }
  return total;
}

function taskMinutesOnDate(
  tasks: PlanningTask[],
  dateKey: string,
  winStart: Date,
  winEnd: Date,
): number {
  let total = 0;
  for (const t of tasks) {
    if (t.status === 'done' || t.status === 'cancelled') continue;
    if (t.plannedStart && t.plannedEnd) {
      const s = new Date(t.plannedStart);
      const en = new Date(t.plannedEnd);
      total += overlapMinutes(s, en, winStart, winEnd);
      continue;
    }
    if (t.plannedDate && t.plannedDate.slice(0, 10) === dateKey) {
      total += t.estimatedMinutes ?? 30;
    }
  }
  return total;
}

export function computeDailyLoad(
  date: Date,
  events: PlanningEvent[],
  tasks: PlanningTask[],
  wh: WorkingHours,
): DailyLoad {
  const key = toDateKey(date);
  const { start, end, available } = dayWindow(date, wh);
  const isRestDay = available === 0;
  const eventMinutes = isRestDay ? 0 : eventMinutesInWindow(events, start, end);
  const scheduledTaskMinutes = isRestDay ? 0 : taskMinutesOnDate(tasks, key, start, end);
  const busy = eventMinutes + scheduledTaskMinutes;
  const freeMinutes = Math.max(0, available - busy);
  const loadPercentage = available > 0 ? busy / available : 0;
  return {
    date: key,
    totalAvailableMinutes: available,
    scheduledTaskMinutes,
    eventMinutes,
    freeMinutes,
    loadPercentage,
    isRestDay,
  };
}
