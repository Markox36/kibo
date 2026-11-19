import * as ical from 'node-ical';

export interface ParsedIcsEvent {
  externalUid: string;
  title: string;
  description: string | null;
  start: string;
  end: string;
  allDay: boolean;
  location: string | null;
  rrule: string | null;
}

export interface ParsedIcs {
  name: string | null;
  events: ParsedIcsEvent[];
}

function toIsoUtc(d: Date): string {
  return new Date(d.getTime()).toISOString();
}

function extractRruleString(rawIcs: string, uid: string): string | null {
  const uidLine = `UID:${uid}`;
  const uidIdx = rawIcs.indexOf(uidLine);
  if (uidIdx < 0) return null;
  const eventStart = rawIcs.lastIndexOf('BEGIN:VEVENT', uidIdx);
  const eventEnd = rawIcs.indexOf('END:VEVENT', uidIdx);
  if (eventStart < 0 || eventEnd < 0) return null;
  const block = rawIcs.slice(eventStart, eventEnd);
  const match = block.match(/^RRULE:(.+)$/m);
  return match?.[1]?.trim() ?? null;
}

export function parseIcs(raw: string): ParsedIcs {
  const parsed = ical.sync.parseICS(raw);

  let calName: string | null = null;
  const nameMatch = raw.match(/^X-WR-CALNAME:(.+)$/m);
  if (nameMatch) calName = nameMatch[1]!.trim();

  const events: ParsedIcsEvent[] = [];
  for (const key of Object.keys(parsed)) {
    const item = parsed[key];
    if (!item || item.type !== 'VEVENT') continue;
    const ev = item as ical.VEvent;
    if (!ev.start || !ev.end) continue;

    const uid = (ev.uid ?? key).toString();
    const startDate = ev.start instanceof Date ? ev.start : new Date(ev.start as string);
    const endDate = ev.end instanceof Date ? ev.end : new Date(ev.end as string);
    if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) continue;

    const allDay =
      typeof (ev.start as { dateOnly?: boolean }).dateOnly === 'boolean'
        ? Boolean((ev.start as { dateOnly?: boolean }).dateOnly)
        : startDate.getUTCHours() === 0 &&
          startDate.getUTCMinutes() === 0 &&
          endDate.getTime() - startDate.getTime() >= 24 * 60 * 60 * 1000 - 1;

    events.push({
      externalUid: uid,
      title: (ev.summary ?? '(sin título)').toString().slice(0, 500),
      description: ev.description ? ev.description.toString().slice(0, 20000) : null,
      start: toIsoUtc(startDate),
      end: toIsoUtc(endDate),
      allDay,
      location: ev.location ? ev.location.toString().slice(0, 500) : null,
      rrule: extractRruleString(raw, uid),
    });
  }

  return { name: calName, events };
}
