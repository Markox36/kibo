// Date/format helpers mirrored from the desktop Dashboard so the mobile UI
// speaks the same language (Spanish locale, 24h times, "en 20 min" style).

function pad(n: number): string {
  return n.toString().padStart(2, '0');
}

export function todayIso(d = new Date()): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function greeting(h: number = new Date().getHours()): string {
  if (h < 6) return 'Buenas noches';
  if (h < 13) return 'Buenos días';
  if (h < 20) return 'Buenas tardes';
  return 'Buenas noches';
}

export function longDate(d = new Date()): string {
  return d.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' });
}

export function weekdayShort(d: Date): string {
  return d.toLocaleDateString('es-ES', { weekday: 'short' });
}

export function timeStr(iso: string): string {
  return iso.slice(11, 16);
}

export function minutesUntil(iso: string, now = new Date()): number {
  return Math.round((new Date(iso).getTime() - now.getTime()) / 60000);
}

export function humanUntil(mins: number): string {
  if (mins < 1) return 'ahora';
  if (mins < 60) return `en ${mins} min`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m === 0 ? `en ${h} h` : `en ${h} h ${m} min`;
}

export function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
