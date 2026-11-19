import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import type { EventDto, TaskDto } from './entities-api';
import type { PrefsState } from '../store/prefs';

// Show alerts even when the app is foregrounded.
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: false,
    shouldSetBadge: false,
  }),
});

export async function getPermissionStatus(): Promise<string> {
  const settings = await Notifications.getPermissionsAsync();
  return settings.status;
}

/** Fires a local notification a couple seconds out so the user can confirm
 *  reminders reach the system tray. Returns false if permission is missing. */
export async function sendTestNotification(): Promise<boolean> {
  const ok = await ensureNotificationSetup();
  if (!ok) return false;
  await Notifications.scheduleNotificationAsync({
    content: { title: 'Kibo', body: 'Los recordatorios funcionan ✅' },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
      seconds: 2,
      channelId: 'reminders',
    },
  });
  return true;
}

export async function ensureNotificationSetup(): Promise<boolean> {
  const settings = await Notifications.getPermissionsAsync();
  let status = settings.status;
  if (status !== 'granted') {
    const req = await Notifications.requestPermissionsAsync();
    status = req.status;
  }
  if (status !== 'granted') return false;

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('reminders', {
      name: 'Recordatorios',
      importance: Notifications.AndroidImportance.DEFAULT,
      lightColor: '#7c8cff',
    });
  }
  return true;
}

function scheduleAt(when: Date, title: string, body: string) {
  if (when.getTime() <= Date.now()) return null;
  return Notifications.scheduleNotificationAsync({
    content: { title, body },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DATE,
      date: when,
      channelId: 'reminders',
    },
  });
}

/**
 * Recomputes all local reminders from scratch: cancels every scheduled
 * notification and re-schedules based on current prefs, events and tasks.
 * Idempotent — safe to call on every data refresh.
 */
export async function syncReminders(
  events: EventDto[],
  tasks: TaskDto[],
  prefs: PrefsState,
): Promise<number> {
  await Notifications.cancelAllScheduledNotificationsAsync();
  if (!prefs.notificationsEnabled) return 0;

  const ok = await ensureNotificationSetup();
  if (!ok) return 0;

  const lead = prefs.reminderLeadMinutes * 60_000;
  const jobs: Array<Promise<unknown> | null> = [];

  if (prefs.notifyEvents) {
    for (const e of events) {
      if (e.allDay) continue;
      const when = new Date(new Date(e.start).getTime() - lead);
      jobs.push(
        scheduleAt(
          when,
          e.title,
          prefs.reminderLeadMinutes > 0
            ? `Empieza en ${prefs.reminderLeadMinutes} min`
            : 'Empieza ahora',
        ),
      );
    }
  }

  if (prefs.notifyTaskDue) {
    for (const t of tasks) {
      if (t.status === 'done' || !t.dueDate) continue;
      // Due at 09:00 local on the due date, minus lead time.
      const due = new Date(`${t.dueDate}T09:00:00`);
      jobs.push(scheduleAt(new Date(due.getTime() - lead), t.title, 'Tarea con vencimiento hoy'));
    }
  }

  const results = await Promise.all(jobs.filter(Boolean) as Promise<unknown>[]);
  return results.length;
}
