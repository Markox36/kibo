import { useEffect } from 'react';
import { useEvents } from './useEvents';
import { useTasks } from './useTasks';
import { usePrefs } from '../store/prefs';
import { syncReminders } from '../lib/notifications';

/**
 * Keeps local notifications in sync with the user's data and preferences.
 * Mounted once inside the authenticated tab layout; re-runs whenever the
 * relevant inputs change.
 */
export function useReminderSync() {
  const events = useEvents();
  const tasks = useTasks();
  const notificationsEnabled = usePrefs((s) => s.notificationsEnabled);
  const reminderLeadMinutes = usePrefs((s) => s.reminderLeadMinutes);
  const notifyEvents = usePrefs((s) => s.notifyEvents);
  const notifyTaskDue = usePrefs((s) => s.notifyTaskDue);

  useEffect(() => {
    const e = events.data;
    const t = tasks.data;
    if (!e || !t) return;
    syncReminders(e, t, usePrefs.getState()).catch(() => {
      // Best-effort; a failed sync just means reminders aren't updated this round.
    });
  }, [
    events.data,
    tasks.data,
    notificationsEnabled,
    reminderLeadMinutes,
    notifyEvents,
    notifyTaskDue,
  ]);
}
