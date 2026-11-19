import AsyncStorage from '@react-native-async-storage/async-storage';
import type { EventDto } from '../lib/entities-api';
import { todayIso, timeStr } from '../lib/format';

// The widget task handler runs in a headless JS context with no access to the
// app's React Query cache, so the app persists a small snapshot of today's
// events here and the handler reads it back.
const KEY = 'kibo.widget.today';

export interface WidgetEvent {
  title: string;
  time: string; // "18:30" or "Todo el día"
  color: string;
}

export interface WidgetSnapshot {
  dateLabel: string;
  events: WidgetEvent[];
}

export async function writeWidgetSnapshot(
  events: EventDto[],
  colorByCal: Record<string, string>,
): Promise<WidgetSnapshot> {
  const today = todayIso();
  const now = new Date();
  const dateLabel = now
    .toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' })
    .replace(/^\w/, (c) => c.toUpperCase());

  const todays: WidgetEvent[] = events
    .filter((e) => e.start.slice(0, 10) === today)
    .sort((a, b) => a.start.localeCompare(b.start))
    .map((e) => ({
      title: e.title,
      time: e.allDay ? 'Todo el día' : `${timeStr(e.start)}–${timeStr(e.end)}`,
      color: colorByCal[e.calendarId] ?? '#7c8cff',
    }));

  const snapshot: WidgetSnapshot = { dateLabel, events: todays };
  await AsyncStorage.setItem(KEY, JSON.stringify(snapshot));
  return snapshot;
}

export async function readWidgetSnapshot(): Promise<WidgetSnapshot> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    if (raw) return JSON.parse(raw) as WidgetSnapshot;
  } catch {
    // fall through to empty
  }
  const now = new Date();
  const dateLabel = now
    .toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' })
    .replace(/^\w/, (c) => c.toUpperCase());
  return { dateLabel, events: [] };
}
