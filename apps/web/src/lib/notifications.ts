export type NotifPermission = 'default' | 'granted' | 'denied' | 'unsupported';

export function notifSupported(): boolean {
  return typeof window !== 'undefined' && 'Notification' in window;
}

export function currentPermission(): NotifPermission {
  if (!notifSupported()) return 'unsupported';
  return Notification.permission as NotifPermission;
}

export async function requestPermission(): Promise<NotifPermission> {
  if (!notifSupported()) return 'unsupported';
  if (Notification.permission === 'granted' || Notification.permission === 'denied') {
    return Notification.permission as NotifPermission;
  }
  const res = await Notification.requestPermission();
  return res as NotifPermission;
}

export interface NotifyOpts {
  title: string;
  body?: string;
  tag?: string;
  silent?: boolean;
  onClick?: () => void;
}

export function notify(opts: NotifyOpts): Notification | null {
  if (!notifSupported() || Notification.permission !== 'granted') return null;
  try {
    const n = new Notification(opts.title, {
      body: opts.body,
      tag: opts.tag,
      silent: opts.silent,
      icon: '/favicon.ico',
    });
    if (opts.onClick) {
      n.onclick = () => {
        window.focus();
        opts.onClick!();
        n.close();
      };
    }
    return n;
  } catch {
    return null;
  }
}
