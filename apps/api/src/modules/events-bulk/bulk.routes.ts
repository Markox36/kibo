import type { FastifyInstance } from 'fastify';
import type { Filter } from 'mongodb';
import { z } from 'zod';
import { nowUtc } from '@kibo/shared';
import { coll } from '../../utils/collections.js';
import { ChangeLogService } from '../sync/change-log.service.js';

const MAX_REGEX_LEN = 200;
const MAX_DELETE = 5000;

const BulkFilter = z
  .object({
    calendarIds: z.array(z.string()).max(50).optional(),
    titleRegex: z.string().max(MAX_REGEX_LEN).optional(),
    titleCaseInsensitive: z.boolean().default(true).optional(),
    from: z.string().optional(),
    to: z.string().optional(),
    allDayOnly: z.boolean().optional(),
    timedOnly: z.boolean().optional(),
    recurringOnly: z.boolean().optional(),
    importedOnly: z.boolean().optional(),
  })
  .refine(
    (v) =>
      Boolean(
        (v.calendarIds && v.calendarIds.length > 0) ||
          v.titleRegex ||
          v.from ||
          v.to ||
          v.allDayOnly ||
          v.timedOnly ||
          v.recurringOnly ||
          v.importedOnly,
      ),
    { message: 'need_at_least_one_filter' },
  );

interface EventDoc {
  _id: string;
  workspaceId: string;
  version: number;
  updatedAt: string;
  deletedAt: string | null;
  calendarId: string;
  title: string;
  start: string;
  end: string;
  allDay: boolean;
  externalUid?: string | null;
  rrule?: string | null;
}

function buildMongoFilter(
  workspaceId: string,
  input: z.infer<typeof BulkFilter>,
): Filter<EventDoc> {
  const filter: Filter<EventDoc> = { workspaceId, deletedAt: null };
  if (input.calendarIds && input.calendarIds.length > 0) {
    filter.calendarId = { $in: input.calendarIds };
  }
  if (input.titleRegex) {
    filter.title = {
      $regex: input.titleRegex,
      $options: input.titleCaseInsensitive === false ? '' : 'i',
    };
  }
  if (input.from || input.to) {
    const start: Record<string, string> = {};
    if (input.from) start.$gte = input.from;
    if (input.to) start.$lte = input.to;
    filter.start = start;
  }
  if (input.allDayOnly) filter.allDay = true;
  if (input.timedOnly) filter.allDay = false;
  if (input.recurringOnly) filter.rrule = { $type: 'string', $ne: null };
  if (input.importedOnly) filter.externalUid = { $type: 'string', $ne: null };
  return filter;
}

function validateRegex(pattern: string | undefined): true | { error: string } {
  if (!pattern) return true;
  try {
    // Precompile client-side to catch bad syntax; MongoDB uses PCRE-like separately
    new RegExp(pattern);
    return true;
  } catch {
    return { error: 'invalid_regex' };
  }
}

export async function eventsBulkRoutes(app: FastifyInstance): Promise<void> {
  app.post(
    '/events/bulk-preview',
    { preHandler: app.requireAuth },
    async (req, reply) => {
      const parsed = BulkFilter.safeParse(req.body);
      if (!parsed.success)
        return reply.code(400).send({ error: 'bad_input', issues: parsed.error.flatten() });
      const rx = validateRegex(parsed.data.titleRegex);
      if (rx !== true) return reply.code(400).send(rx);

      const filter = buildMongoFilter(req.auth!.workspaceId, parsed.data);
      const collection = coll<EventDoc>(app.db, 'events');
      const count = await collection.countDocuments(filter);
      const sample = await collection
        .find(filter, { projection: { title: 1, start: 1, calendarId: 1, allDay: 1 } })
        .sort({ start: 1 })
        .limit(20)
        .toArray();
      return {
        count,
        sample: sample.map((d) => ({
          id: d._id,
          title: d.title,
          start: d.start,
          calendarId: d.calendarId,
          allDay: d.allDay,
        })),
      };
    },
  );

  app.post(
    '/events/bulk-delete',
    { preHandler: app.requireAuth },
    async (req, reply) => {
      if (!(await app.checkFlag('bulkDeleteEnabled', reply))) return;
      if (!(await app.ensureNotReadOnly(reply))) return;
      if (!(await app.ensureNotMaintenance(req, reply))) return;
      const parsed = BulkFilter.safeParse(req.body);
      if (!parsed.success)
        return reply.code(400).send({ error: 'bad_input', issues: parsed.error.flatten() });
      const rx = validateRegex(parsed.data.titleRegex);
      if (rx !== true) return reply.code(400).send(rx);

      const filter = buildMongoFilter(req.auth!.workspaceId, parsed.data);
      const collection = coll<EventDoc>(app.db, 'events');
      const count = await collection.countDocuments(filter);
      if (count > MAX_DELETE)
        return reply.code(400).send({ error: 'too_many', count, max: MAX_DELETE });

      const changelog = new ChangeLogService(app.db);
      const now = nowUtc();
      const targets = await collection
        .find(filter, { projection: { _id: 1, version: 1 } })
        .toArray();

      if (targets.length === 0) return { deleted: 0 };

      const ids = targets.map((t) => t._id);
      await collection.updateMany(
        { _id: { $in: ids }, workspaceId: req.auth!.workspaceId, deletedAt: null },
        { $set: { deletedAt: now, updatedAt: now }, $inc: { version: 1 } },
      );

      for (const t of targets) {
        const nextVersion = t.version + 1;
        await changelog.record({
          workspaceId: req.auth!.workspaceId,
          entityType: 'event',
          entityId: t._id,
          operation: 'delete',
          version: nextVersion,
          actorUserId: req.auth!.sub,
          payloadSnapshot: { id: t._id, deletedAt: now, version: nextVersion },
        });
      }

      return { deleted: targets.length };
    },
  );
}
