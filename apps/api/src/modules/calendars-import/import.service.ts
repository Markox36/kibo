import type { Db } from 'mongodb';
import { newUlid, nowUtc } from '@kibo/shared';
import { coll } from '../../utils/collections.js';
import { ChangeLogService } from '../sync/change-log.service.js';
import type { ParsedIcs } from './ical-parser.js';

interface CalendarDoc {
  _id: string;
  workspaceId: string;
  version: number;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
  name: string;
  color: string;
  visible: boolean;
  type: 'internal' | 'ics_file' | 'ics_url';
  externalUrl?: string | null;
  externalLastSyncAt?: string | null;
  order: number;
  isDefault: boolean;
}

interface EventDoc {
  _id: string;
  workspaceId: string;
  version: number;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
  calendarId: string;
  title: string;
  description: string | null;
  start: string;
  end: string;
  allDay: boolean;
  tagIds: string[];
  reminder: 'none' | '5m' | '10m' | '30m' | '1h' | '1d';
  location: string | null;
  externalUid: string | null;
  rrule: string | null;
}

const PALETTE = ['#7c8cff', '#f59e0b', '#10b981', '#ef4444', '#a78bfa', '#06b6d4', '#f472b6'];

export interface ImportOptions {
  db: Db;
  workspaceId: string;
  actorUserId: string;
  parsed: ParsedIcs;
  calendar: {
    name?: string;
    color?: string;
    type: 'ics_file' | 'ics_url';
    externalUrl?: string | null;
  };
}

export interface ImportResult {
  calendarId: string;
  eventsInserted: number;
  eventsSkipped: number;
}

export async function importIcsAsNewCalendar(opts: ImportOptions): Promise<ImportResult> {
  const { db, workspaceId, actorUserId, parsed, calendar } = opts;
  const changelog = new ChangeLogService(db);
  const now = nowUtc();

  const calendars = coll<CalendarDoc>(db, 'calendars');
  const events = coll<EventDoc>(db, 'events');

  const existingCount = await calendars.countDocuments({ workspaceId, deletedAt: null });
  const calDoc: CalendarDoc = {
    _id: newUlid(),
    workspaceId,
    version: 1,
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
    name: (calendar.name?.trim() || parsed.name || 'Calendario importado').slice(0, 200),
    color: calendar.color ?? PALETTE[existingCount % PALETTE.length]!,
    visible: true,
    type: calendar.type,
    externalUrl: calendar.externalUrl ?? null,
    externalLastSyncAt: now,
    order: existingCount,
    isDefault: false,
  };
  await calendars.insertOne(calDoc);
  await changelog.record({
    workspaceId,
    entityType: 'calendar',
    entityId: calDoc._id,
    operation: 'create',
    version: 1,
    actorUserId,
    payloadSnapshot: { id: calDoc._id, ...calDoc },
  });

  let inserted = 0;
  let skipped = 0;
  for (const p of parsed.events) {
    if (!p.externalUid) {
      skipped++;
      continue;
    }
    const doc: EventDoc = {
      _id: newUlid(),
      workspaceId,
      version: 1,
      createdAt: now,
      updatedAt: now,
      deletedAt: null,
      calendarId: calDoc._id,
      title: p.title,
      description: p.description,
      start: p.start,
      end: p.end,
      allDay: p.allDay,
      tagIds: [],
      reminder: 'none',
      location: p.location,
      externalUid: p.externalUid,
      rrule: p.rrule,
    };
    await events.insertOne(doc);
    await changelog.record({
      workspaceId,
      entityType: 'event',
      entityId: doc._id,
      operation: 'create',
      version: 1,
      actorUserId,
      payloadSnapshot: { id: doc._id, ...doc },
    });
    inserted++;
  }

  return { calendarId: calDoc._id, eventsInserted: inserted, eventsSkipped: skipped };
}

export interface SyncResult {
  eventsInserted: number;
  eventsUpdated: number;
  eventsDeleted: number;
  eventsSkipped: number;
}

export async function syncIcsUrlCalendar(args: {
  db: Db;
  workspaceId: string;
  actorUserId: string;
  calendarId: string;
  parsed: ParsedIcs;
}): Promise<SyncResult> {
  const { db, workspaceId, actorUserId, calendarId, parsed } = args;
  const changelog = new ChangeLogService(db);
  const now = nowUtc();
  const events = coll<EventDoc>(db, 'events');
  const calendars = coll<CalendarDoc>(db, 'calendars');

  const existing = await events
    .find({ workspaceId, calendarId, deletedAt: null })
    .toArray();
  const existingByUid = new Map<string, EventDoc>();
  for (const e of existing) if (e.externalUid) existingByUid.set(e.externalUid, e);

  let inserted = 0;
  let updated = 0;
  let deleted = 0;
  let skipped = 0;

  const incomingUids = new Set<string>();
  for (const p of parsed.events) {
    if (!p.externalUid) {
      skipped++;
      continue;
    }
    incomingUids.add(p.externalUid);
    const prior = existingByUid.get(p.externalUid);
    if (prior) {
      const changed =
        prior.title !== p.title ||
        prior.start !== p.start ||
        prior.end !== p.end ||
        prior.allDay !== p.allDay ||
        prior.location !== p.location ||
        prior.description !== p.description ||
        prior.rrule !== p.rrule;
      if (!changed) {
        skipped++;
        continue;
      }
      const nextVersion = prior.version + 1;
      await events.updateOne(
        { _id: prior._id, workspaceId },
        {
          $set: {
            title: p.title,
            description: p.description,
            start: p.start,
            end: p.end,
            allDay: p.allDay,
            location: p.location,
            rrule: p.rrule,
            updatedAt: now,
            version: nextVersion,
          },
        },
      );
      await changelog.record({
        workspaceId,
        entityType: 'event',
        entityId: prior._id,
        operation: 'update',
        version: nextVersion,
        actorUserId,
        payloadSnapshot: {
          id: prior._id,
          title: p.title,
          start: p.start,
          end: p.end,
          allDay: p.allDay,
          rrule: p.rrule,
        },
      });
      updated++;
      continue;
    }
    const doc: EventDoc = {
      _id: newUlid(),
      workspaceId,
      version: 1,
      createdAt: now,
      updatedAt: now,
      deletedAt: null,
      calendarId,
      title: p.title,
      description: p.description,
      start: p.start,
      end: p.end,
      allDay: p.allDay,
      tagIds: [],
      reminder: 'none',
      location: p.location,
      externalUid: p.externalUid,
      rrule: p.rrule,
    };
    await events.insertOne(doc);
    await changelog.record({
      workspaceId,
      entityType: 'event',
      entityId: doc._id,
      operation: 'create',
      version: 1,
      actorUserId,
      payloadSnapshot: { id: doc._id, ...doc },
    });
    inserted++;
  }

  for (const [uid, prior] of existingByUid) {
    if (incomingUids.has(uid)) continue;
    const nextVersion = prior.version + 1;
    await events.updateOne(
      { _id: prior._id, workspaceId },
      { $set: { deletedAt: now, updatedAt: now, version: nextVersion } },
    );
    await changelog.record({
      workspaceId,
      entityType: 'event',
      entityId: prior._id,
      operation: 'delete',
      version: nextVersion,
      actorUserId,
      payloadSnapshot: { id: prior._id, deletedAt: now, version: nextVersion },
    });
    deleted++;
  }

  await calendars.updateOne(
    { _id: calendarId, workspaceId, deletedAt: null },
    { $set: { externalLastSyncAt: now, updatedAt: now }, $inc: { version: 1 } },
  );

  return { eventsInserted: inserted, eventsUpdated: updated, eventsDeleted: deleted, eventsSkipped: skipped };
}
