import type { FastifyInstance } from 'fastify';
import type { z } from 'zod';
import type { Db } from 'mongodb';
import { newUlid, nowUtc } from '@kibo/shared';
import type { EntityType } from '@kibo/shared';
import { ChangeLogService } from '../sync/change-log.service.js';
import { coll } from '../../utils/collections.js';

export interface CrudOptions<TCreate, TUpdate> {
  path: string;
  collection: string;
  entityType: EntityType;
  createSchema: z.ZodType<TCreate>;
  updateSchema: z.ZodType<TUpdate>;
}

interface EntityDoc {
  _id: string;
  workspaceId: string;
  version: number;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
  [k: string]: unknown;
}

export function crudRoutes<TCreate, TUpdate>(
  opts: CrudOptions<TCreate, TUpdate>,
): (app: FastifyInstance) => Promise<void> {
  return async (app: FastifyInstance) => {
    const changelog = new ChangeLogService(app.db);
    const col = (db: Db) => coll<EntityDoc>(db, opts.collection);

    app.get(opts.path, { preHandler: app.requireAuth }, async (req) => {
      const docs = await col(app.db)
        .find({ workspaceId: req.auth!.workspaceId, deletedAt: null })
        .sort({ updatedAt: -1 })
        .limit(5000)
        .toArray();
      return docs.map(({ _id, ...rest }) => ({ id: _id, ...rest }));
    });

    app.get<{ Params: { id: string } }>(
      `${opts.path}/:id`,
      { preHandler: app.requireAuth },
      async (req, reply) => {
        const doc = await col(app.db).findOne({
          _id: req.params.id,
          workspaceId: req.auth!.workspaceId,
        });
        if (!doc) return reply.code(404).send({ error: 'not_found' });
        const { _id, ...rest } = doc;
        return { id: _id, ...rest };
      },
    );

    app.post(opts.path, { preHandler: app.requireAuth }, async (req, reply) => {
      const parsed = opts.createSchema.safeParse(req.body);
      if (!parsed.success)
        return reply.code(400).send({ error: 'bad_input', issues: parsed.error.flatten() });
      const now = nowUtc();
      const id = newUlid();
      const doc: EntityDoc = {
        _id: id,
        workspaceId: req.auth!.workspaceId,
        version: 1,
        createdAt: now,
        updatedAt: now,
        deletedAt: null,
        ...(parsed.data as Record<string, unknown>),
      };
      await col(app.db).insertOne(doc);
      await changelog.record({
        workspaceId: req.auth!.workspaceId,
        entityType: opts.entityType,
        entityId: id,
        operation: 'create',
        version: 1,
        actorUserId: req.auth!.sub,
        payloadSnapshot: { id, ...doc },
      });
      const { _id, ...rest } = doc;
      return reply.code(201).send({ id: _id, ...rest });
    });

    app.patch<{ Params: { id: string } }>(
      `${opts.path}/:id`,
      { preHandler: app.requireAuth },
      async (req, reply) => {
        const parsed = opts.updateSchema.safeParse(req.body);
        if (!parsed.success)
          return reply.code(400).send({ error: 'bad_input', issues: parsed.error.flatten() });
        const now = nowUtc();
        const filter = {
          _id: req.params.id,
          workspaceId: req.auth!.workspaceId,
          deletedAt: null,
        };
        const result = await col(app.db).findOneAndUpdate(
          filter,
          {
            $set: { ...(parsed.data as Record<string, unknown>), updatedAt: now },
            $inc: { version: 1 },
          } as never,
          { returnDocument: 'after' },
        );
        if (!result) return reply.code(404).send({ error: 'not_found' });
        const doc = result;
        await changelog.record({
          workspaceId: req.auth!.workspaceId,
          entityType: opts.entityType,
          entityId: req.params.id,
          operation: 'update',
          version: doc.version,
          actorUserId: req.auth!.sub,
          payloadSnapshot: { id: doc._id, ...doc },
        });
        const { _id, ...rest } = doc;
        return { id: _id, ...rest };
      },
    );

    app.delete<{ Params: { id: string } }>(
      `${opts.path}/:id`,
      { preHandler: app.requireAuth },
      async (req, reply) => {
        const now = nowUtc();
        const filter = {
          _id: req.params.id,
          workspaceId: req.auth!.workspaceId,
          deletedAt: null,
        };
        const result = await col(app.db).findOneAndUpdate(
          filter,
          { $set: { deletedAt: now, updatedAt: now }, $inc: { version: 1 } } as never,
          { returnDocument: 'after' },
        );
        if (!result) return reply.code(404).send({ error: 'not_found' });
        await changelog.record({
          workspaceId: req.auth!.workspaceId,
          entityType: opts.entityType,
          entityId: req.params.id,
          operation: 'delete',
          version: result.version,
          actorUserId: req.auth!.sub,
          payloadSnapshot: { id: result._id, deletedAt: now, version: result.version },
        });
        return reply.code(204).send();
      },
    );
  };
}
