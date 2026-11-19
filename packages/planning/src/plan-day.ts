import type { PlanningEvent, WorkingHours } from './load.js';

export interface PlannerTask {
  id: string;
  title: string;
  status: string;
  priority?: string | null;
  energy?: string | null;
  estimatedMinutes?: number | null;
  plannedDate?: string | null;
  plannedStart?: string | null;
  plannedEnd?: string | null;
  dueDate?: string | null;
  updatedAt?: string;
}

export interface FreeSlot {
  start: Date;
  end: Date;
  minutes: number;
  block: TimeBlock;
}

export interface PlanSuggestion {
  taskId: string;
  taskTitle: string;
  start: Date;
  end: Date;
  minutes: number;
  score: number;
  reasons: string[];
}

export type TimeBlock = 'morning' | 'afternoon' | 'night';

function parseHm(hm: string): { h: number; m: number } {
  const [h, m] = hm.split(':').map((s) => parseInt(s, 10));
  return { h: h ?? 0, m: m ?? 0 };
}

function timeBlockAt(d: Date): TimeBlock {
  const h = d.getHours();
  if (h < 12) return 'morning';
  if (h < 18) return 'afternoon';
  return 'night';
}

function dayWindow(date: Date, wh: WorkingHours): { start: Date; end: Date } | null {
  const dow = date.getDay();
  const isWeekend = dow === 0 || dow === 6;
  if (isWeekend && !wh.workOnWeekends) return null;
  const { h: sh, m: sm } = parseHm(wh.start);
  const { h: eh, m: em } = parseHm(wh.end);
  const start = new Date(date.getFullYear(), date.getMonth(), date.getDate(), sh, sm, 0, 0);
  const end = new Date(date.getFullYear(), date.getMonth(), date.getDate(), eh, em, 0, 0);
  if (end <= start) return null;
  return { start, end };
}

interface Interval {
  start: Date;
  end: Date;
}

function taskBlockOnDate(t: PlannerTask, dateKey: string): Interval | null {
  if (t.plannedStart && t.plannedEnd) {
    const s = new Date(t.plannedStart);
    const e = new Date(t.plannedEnd);
    if (e > s) return { start: s, end: e };
  }
  if (t.plannedDate && t.plannedDate.slice(0, 10) === dateKey) {
    return null;
  }
  return null;
}

function computeFreeSlots(
  windowStart: Date,
  windowEnd: Date,
  busy: Interval[],
  minSlotMinutes: number,
): FreeSlot[] {
  const clipped: Interval[] = [];
  for (const b of busy) {
    const s = new Date(Math.max(b.start.getTime(), windowStart.getTime()));
    const e = new Date(Math.min(b.end.getTime(), windowEnd.getTime()));
    if (e > s) clipped.push({ start: s, end: e });
  }
  clipped.sort((a, b) => a.start.getTime() - b.start.getTime());

  const merged: Interval[] = [];
  for (const iv of clipped) {
    const last = merged[merged.length - 1];
    if (last && iv.start.getTime() <= last.end.getTime()) {
      if (iv.end.getTime() > last.end.getTime()) last.end = iv.end;
    } else {
      merged.push({ start: iv.start, end: iv.end });
    }
  }

  const slots: FreeSlot[] = [];
  let cursor = windowStart;
  for (const b of merged) {
    if (b.start > cursor) {
      const minutes = (b.start.getTime() - cursor.getTime()) / 60000;
      if (minutes >= minSlotMinutes) {
        slots.push({ start: new Date(cursor), end: new Date(b.start), minutes, block: timeBlockAt(cursor) });
      }
    }
    if (b.end > cursor) cursor = b.end;
  }
  if (windowEnd > cursor) {
    const minutes = (windowEnd.getTime() - cursor.getTime()) / 60000;
    if (minutes >= minSlotMinutes) {
      slots.push({ start: new Date(cursor), end: new Date(windowEnd), minutes, block: timeBlockAt(cursor) });
    }
  }
  return slots;
}

function toDateKey(d: Date): string {
  const y = d.getFullYear();
  const m = (d.getMonth() + 1).toString().padStart(2, '0');
  const day = d.getDate().toString().padStart(2, '0');
  return `${y}-${m}-${day}`;
}

const PRIORITY_SCORE: Record<string, number> = {
  low: 0,
  medium: 2,
  high: 4,
};

const ENERGY_BLOCK: Record<string, TimeBlock> = {
  high: 'morning',
  medium: 'afternoon',
  low: 'night',
};

interface ScoredCandidate {
  task: PlannerTask;
  minutes: number;
  score: number;
  reasons: string[];
}

function scoreCandidate(t: PlannerTask, today: string): ScoredCandidate | null {
  if (t.status === 'done' || t.status === 'cancelled') return null;
  const minutes = t.estimatedMinutes ?? 30;
  if (minutes <= 0) return null;
  const plannedKey = t.plannedDate?.slice(0, 10);
  if (plannedKey === today && (t.plannedStart || t.plannedEnd)) return null;

  const reasons: string[] = [];
  let score = 0;

  if (t.priority) {
    const p = PRIORITY_SCORE[t.priority] ?? 0;
    score += p;
    if (p > 0) reasons.push(`prioridad ${t.priority}`);
  }

  if (t.dueDate) {
    const dueKey = t.dueDate.slice(0, 10);
    if (dueKey < today) {
      score += 10;
      reasons.push('deadline vencido');
    } else if (dueKey === today) {
      score += 8;
      reasons.push('vence hoy');
    } else {
      const daysUntil = Math.round(
        (new Date(`${dueKey}T00:00:00`).getTime() - new Date(`${today}T00:00:00`).getTime()) / 86400000,
      );
      if (daysUntil <= 2) {
        score += 6;
        reasons.push(`vence en ${daysUntil}d`);
      } else if (daysUntil <= 7) {
        score += 3;
        reasons.push(`vence en ${daysUntil}d`);
      }
    }
  }

  if (plannedKey && plannedKey < today) {
    score += 5;
    reasons.push('arrastrada de días pasados');
  }

  return { task: t, minutes, score, reasons };
}

export interface PlanDayOptions {
  minSlotMinutes?: number;
  gapBetweenBlocksMinutes?: number;
  now?: Date;
}

export function suggestPlanForDay(
  date: Date,
  tasks: PlannerTask[],
  events: PlanningEvent[],
  wh: WorkingHours,
  options: PlanDayOptions = {},
): PlanSuggestion[] {
  const win = dayWindow(date, wh);
  if (!win) return [];

  const now = options.now ?? new Date();
  const minSlot = options.minSlotMinutes ?? 15;
  const gap = options.gapBetweenBlocksMinutes ?? 0;
  const dateKey = toDateKey(date);
  const todayKey = toDateKey(now);
  const isToday = dateKey === todayKey;

  const windowStart = isToday && now > win.start && now < win.end ? new Date(now) : win.start;
  if (windowStart >= win.end) return [];

  const busy: Interval[] = [];
  for (const e of events) {
    if (e.allDay) continue;
    const s = new Date(e.start);
    const en = new Date(e.end);
    if (en <= windowStart || s >= win.end) continue;
    busy.push({ start: s, end: en });
  }
  for (const t of tasks) {
    const iv = taskBlockOnDate(t, dateKey);
    if (!iv) continue;
    if (iv.end <= windowStart || iv.start >= win.end) continue;
    busy.push(iv);
  }

  const slots = computeFreeSlots(windowStart, win.end, busy, minSlot);
  if (slots.length === 0) return [];

  const candidates: ScoredCandidate[] = [];
  for (const t of tasks) {
    const c = scoreCandidate(t, todayKey);
    if (c) candidates.push(c);
  }
  candidates.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return (b.task.updatedAt ?? '').localeCompare(a.task.updatedAt ?? '');
  });

  const remainingSlots: FreeSlot[] = slots.map((s) => ({ ...s }));
  const suggestions: PlanSuggestion[] = [];

  for (const c of candidates) {
    let bestIdx = -1;
    let bestSpare = Infinity;
    for (let i = 0; i < remainingSlots.length; i += 1) {
      const s = remainingSlots[i]!;
      if (s.minutes >= c.minutes) {
        const spare = s.minutes - c.minutes;
        if (spare < bestSpare) {
          bestSpare = spare;
          bestIdx = i;
        }
      }
    }
    if (bestIdx === -1) continue;
    const slot = remainingSlots[bestIdx]!;
    const start = new Date(slot.start);
    const end = new Date(start.getTime() + c.minutes * 60000);

    const reasons = [...c.reasons];
    if (c.task.energy) {
      const wanted = ENERGY_BLOCK[c.task.energy];
      if (wanted && wanted === slot.block) reasons.push(`energía ${c.task.energy} encaja con ${slot.block}`);
    }

    suggestions.push({
      taskId: c.task.id,
      taskTitle: c.task.title,
      start,
      end,
      minutes: c.minutes,
      score: c.score,
      reasons,
    });

    const consumed = c.minutes + gap;
    const newStart = new Date(slot.start.getTime() + consumed * 60000);
    if (newStart >= slot.end) {
      remainingSlots.splice(bestIdx, 1);
    } else {
      slot.start = newStart;
      slot.minutes = (slot.end.getTime() - slot.start.getTime()) / 60000;
      slot.block = timeBlockAt(slot.start);
    }
  }

  suggestions.sort((a, b) => a.start.getTime() - b.start.getTime());
  return suggestions;
}
