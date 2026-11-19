import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { newUlid, nowUtc } from '@kibo/shared';
import { coll } from '../../utils/collections.js';

interface DeviceDoc {
  _id: string;
  userId: string;
  workspaceId: string;
  deviceName: string;
  platform: 'desktop' | 'web' | 'mobile';
  appVersion: string;
  lastSyncAt: string | null;
  lastSyncCursor: string | null;
  createdAt: string;
  updatedAt: string;
}

const RegisterDeviceInput = z.object({
  deviceName: z.string().min(1).max(200),
  platform: z.enum(['desktop', 'web', 'mobile']),
  appVersion: z.string().max(50).default('0.1.0'),
});

const UpdateDeviceInput = z.object({
  deviceName: z.string().min(1).max(200).optional(),
  lastSyncCursor: z.string().nullable().optional(),
});

export async function deviceRoutes(app: FastifyInstance): Promise<void> {
  app.get('/devices', { preHandler: app.requireAuth }, async (req) => {
    const docs = await coll<DeviceDoc>(app.db, 'devices')
      .find({ userId: req.auth!.sub })
      .sort({ createdAt: -1 })
      .toArray();
    return docs.map(({ _id, ...rest }) => ({ id: _id, ...rest }));
  });

  app.post('/devices', { preHandler: app.requireAuth }, async (req, reply) => {
    const parsed = RegisterDeviceInput.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: 'bad_input' });
    const now = nowUtc();
    const doc: DeviceDoc = {
      _id: newUlid(),
      userId: req.auth!.sub,
      workspaceId: req.auth!.workspaceId,
      deviceName: parsed.data.deviceName,
      platform: parsed.data.platform,
      appVersion: parsed.data.appVersion,
      lastSyncAt: null,
      lastSyncCursor: null,
      createdAt: now,
      updatedAt: now,
    };
    await coll<DeviceDoc>(app.db, 'devices').insertOne(doc);
    const { _id, ...rest } = doc;
    return reply.code(201).send({ id: _id, ...rest });
  });

  app.patch<{ Params: { id: string } }>(
    '/devices/:id',
    { preHandler: app.requireAuth },
    async (req, reply) => {
      const parsed = UpdateDeviceInput.safeParse(req.body);
      if (!parsed.success) return reply.code(400).send({ error: 'bad_input' });
      const now = nowUtc();
      const result = await coll<DeviceDoc>(app.db, 'devices').findOneAndUpdate(
        { _id: req.params.id, userId: req.auth!.sub },
        { $set: { ...parsed.data, updatedAt: now } } as never,
        { returnDocument: 'after' },
      );
      if (!result) return reply.code(404).send({ error: 'not_found' });
      const { _id, ...rest } = result;
      return { id: _id, ...rest };
    },
  );

  app.post<{ Params: { id: string } }>(
    '/devices/:id/logout',
    { preHandler: app.requireAuth },
    async (req, reply) => {
      const device = await coll<DeviceDoc>(app.db, 'devices').findOne({
        _id: req.params.id,
        userId: req.auth!.sub,
      });
      if (!device) return reply.code(404).send({ error: 'not_found' });
      await app.db
        .collection('refresh_tokens')
        .updateMany(
          { userId: req.auth!.sub, revokedAt: null },
          { $set: { revokedAt: nowUtc() } },
        );
      await coll<DeviceDoc>(app.db, 'devices').deleteOne({ _id: req.params.id });
      return reply.code(204).send();
    },
  );
}
