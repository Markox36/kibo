import { createElement as h, useEffect } from 'react';
import { Platform } from 'react-native';
import { requestWidgetUpdate } from 'react-native-android-widget';
import { useEvents } from './useEvents';
import { useCalendars } from './useCalendars';
import { KiboCalendarWidget } from '../widget/KiboCalendarWidget';
import { writeWidgetSnapshot } from '../widget/data';

/**
 * Keeps the home-screen calendar widget in sync with the user's events.
 * Mounted once in the authenticated tab layout: whenever events or calendar
 * colors change it persists a fresh snapshot and asks every placed widget to
 * re-render from it. Uses createElement (not JSX) for the widget element to
 * avoid NativeWind's JSX runtime — see KiboCalendarWidget.tsx.
 */
export function useWidgetSync() {
  const events = useEvents();
  const calendars = useCalendars();

  useEffect(() => {
    if (Platform.OS !== 'android') return;
    const evs = events.data;
    if (!evs) return;

    const colorByCal: Record<string, string> = {};
    for (const c of calendars.data ?? []) colorByCal[c.id] = c.color;

    (async () => {
      const snapshot = await writeWidgetSnapshot(evs, colorByCal);
      await requestWidgetUpdate({
        widgetName: 'KiboCalendar',
        renderWidget: () => h(KiboCalendarWidget, { snapshot }),
      });
    })().catch(() => {
      // Best-effort; a failed update just leaves the previous widget content.
    });
  }, [events.data, calendars.data]);
}
