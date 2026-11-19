import type { FastifyInstance } from 'fastify';
import { SyncRequest, nowUtc, FULL_RESYNC_REQUIRED } from '@kibo/shared';
import type { SyncResponse, EntityType } from '@kibo/shared';
import { ChangeLogService } from './change-log.service.js';
import { coll } from '../../utils/collections.js';

type EntityDoc = { _id: string; workspaceId: string; version?: number; [k: string]: unknown };

const ENTITY_COLLECTIONS: Record<EntityType, string> = {
  task: 'tasks',
  event: 'events',
  calendar: 'calendars',
  category: 'categories',
  tag: 'tags',
  inbox: 'inbox',
  time_entry: 'time_entries',
};

export async function syncRoutes(app: FastifyInstance): Promise<void> {
  const changelog = new ChangeLogService(app.db);

  app.post('/sync', { preHandler: app.requireAuth }, async (req, reply) => {
    const parsed = SyncRequest.safeParse(req.body);
    if (!parsed.success)
      return reply.code(400).send({ error: 'bad_input', issues: parsed.error.flatten() });

    const { workspaceId, sub: userId } = req.auth!;
    const { changes, cursor } = parsed.data;
    const applied: SyncResponse['applied'] = [];
    const conflicts: SyncResponse['conflicts'] = [];

    for (const change of changes) {
      const collName = ENTITY_COLLECTIONS[change.entityType];
      if (!collName) continue;
      const col = coll<EntityDoc>(app.db, collName);
      const existing = await col.findOne({ _id: change.entityId, workspaceId } as never);
      const existingVersion = existing ? Number(existing.version ?? 0) : 0;

      if (existing && existingVersion >= change.version) {
        conflicts.push({
          entityType: change.entityType,
          entityId: change.entityId,
          clientVersion: change.version,
          serverVersion: existingVersion,
          resolution: 'server_wins',
        });
        continue;
      }

      const now = nowUtc();
      if (change.operation === 'delete') {
        await col.updateOne(
          { _id: change.entityId, workspaceId } as never,
          {
            $set: {
              deletedAt: now,
              updatedAt: now,
              version: change.version,
              workspaceId,
            },
          } as never,
          { upsert: true },
        );
      } else {
        const payload = { ...change.payload, workspaceId, updatedAt: now, version: change.version };
        await col.updateOne(
          { _id: change.entityId, workspaceId } as never,
          { $set: payload, $setOnInsert: { createdAt: now } } as never,
          { upsert: true },
        );
      }

      const doc = await col.findOne({ _id: change.entityId, workspaceId } as never);
      await changelog.record({
        workspaceId,
        entityType: change.entityType,
        entityId: change.entityId,
        operation: change.operation,
        version: change.version,
        actorUserId: userId,
        payloadSnapshot: doc ?? {},
      });
      applied.push({
        entityType: change.entityType,
        entityId: change.entityId,
        version: change.version,
      });
    }

    // fetch remote changes after cursor
    let fullResyncRequired = false;
    if (cursor) {
      const oldest = await app.db
        .collection('change_log')
        .find({ workspaceId })
        .sort({ _id: 1 })
        .limit(1)
        .toArray();
      if (oldest[0] && String(oldest[0]._id) > cursor) {
        fullResyncRequired = true;
      }
    }

    const remoteChanges = fullResyncRequired ? [] : await changelog.since(workspaceId, cursor);
    const nextCursor =
      remoteChanges.length > 0 ? remoteChanges[remoteChanges.length - 1]!.id : cursor;

    const res: SyncResponse = {
      cursor: nextCursor,
      applied,
      remoteChanges,
      conflicts,
      fullResyncRequired,
      serverTime: nowUtc(),
    };
    return res;
  });

  app.get('/sync/snapshot', { preHandler: app.requireAuth }, async (req) => {
    const { workspaceId } = req.auth!;
    const [tasks, events, calendars, categories, tags, inbox, timeEntries] = await Promise.all([
      app.db.collection('tasks').find({ workspaceId }).toArray(),
      app.db.collection('events').find({ workspaceId }).toArray(),
      app.db.collection('calendars').find({ workspaceId }).toArray(),
      app.db.collection('categories').find({ workspaceId }).toArray(),
      app.db.collection('tags').find({ workspaceId }).toArray(),
      app.db.collection('inbox').find({ workspaceId }).toArray(),
      app.db.collection('time_entries').find({ workspaceId }).toArray(),
    ]);
    const latest = await app.db
      .collection('change_log')
      .find({ workspaceId })
      .sort({ _id: -1 })
      .limit(1)
      .toArray();
    const cursor = latest[0] ? String(latest[0]._id) : null;
    const strip = (d: Record<string, unknown>) => {
      const { _id, ...rest } = d;
      return { id: _id, ...rest };
    };
    return {
      cursor,
      serverTime: nowUtc(),
      entities: {
        tasks: tasks.map(strip),
        events: events.map(strip),
        calendars: calendars.map(strip),
        categories: categories.map(strip),
        tags: tags.map(strip),
        inbox: inbox.map(strip),
        timeEntries: timeEntries.map(strip),
      },
    };
  });

  app.get('/sync/status', { preHandler: app.requireAuth }, async () => ({
    ok: true,
    fullResync: FULL_RESYNC_REQUIRED,
  }));
}
