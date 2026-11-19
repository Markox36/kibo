import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { nowUtc } from '@kibo/shared';
import type { UserDoc, WorkspaceDoc } from '../auth/auth.repository.js';
import type { Env } from '../../config/env.js';
import { coll } from '../../utils/collections.js';
import { decryptString } from '../../utils/crypto-box.js';

const UpdateMeInput = z.object({
  name: z.string().min(1).max(200).optional(),
});

const DeleteMeInput = z.object({
  confirm: z.string(),
});

interface IntegrationDoc {
  _id: string;
  userId: string;
  provider: 'google';
  accessTokenEnc: string;
  refreshTokenEnc: string | null;
}

const WORKSPACE_SCOPED_COLLECTIONS = [
  'calendars',
  'categories',
  'events',
  'inbox',
  'tags',
  'tasks',
  'time_entries',
  'change_log',
] as const;

const USER_SCOPED_COLLECTIONS = [
  'user_integrations',
  'devices',
  'refresh_tokens',
  'email_tokens',
] as const;

export async function userRoutes(app: FastifyInstance, env: Env): Promise<void> {
  app.get('/me', { preHandler: app.requireAuth }, async (req, reply) => {
    const user = await app.db.collection<UserDoc>('users').findOne({ _id: req.auth!.sub });
    if (!user) return reply.code(404).send({ error: 'not_found' });
    return {
      id: user._id,
      email: user.email,
      name: user.name,
      emailVerifiedAt: user.emailVerifiedAt,
      workspaceId: req.auth!.workspaceId,
    };
  });

  app.patch('/me', { preHandler: app.requireAuth }, async (req, reply) => {
    const parsed = UpdateMeInput.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: 'bad_input' });
    await app.db
      .collection<UserDoc>('users')
      .updateOne({ _id: req.auth!.sub }, { $set: { ...parsed.data, updatedAt: nowUtc() } });
    return { ok: true };
  });

  app.delete('/me', { preHandler: app.requireAuth }, async (req, reply) => {
    const parsed = DeleteMeInput.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: 'bad_input' });

    const userId = req.auth!.sub;
    const workspaceId = req.auth!.workspaceId;

    const user = await app.db.collection<UserDoc>('users').findOne({ _id: userId });
    if (!user) return reply.code(404).send({ error: 'not_found' });
    if (parsed.data.confirm.trim().toLowerCase() !== user.emailLower) {
      return reply.code(400).send({ error: 'confirm_mismatch' });
    }

    try {
      const integration = await coll<IntegrationDoc>(app.db, 'user_integrations').findOne({
        userId,
        provider: 'google',
      });
      if (integration && env.INTEGRATIONS_KEY) {
        const token = integration.refreshTokenEnc
          ? decryptString(integration.refreshTokenEnc, env.INTEGRATIONS_KEY)
          : decryptString(integration.accessTokenEnc, env.INTEGRATIONS_KEY);
        await fetch(`https://oauth2.googleapis.com/revoke?token=${encodeURIComponent(token)}`, {
          method: 'POST',
        }).catch(() => undefined);
      }
    } catch (err) {
      req.log.warn({ err }, 'google revoke on account delete failed');
    }

    for (const name of WORKSPACE_SCOPED_COLLECTIONS) {
      await app.db.collection(name).deleteMany({ workspaceId });
    }
    for (const name of USER_SCOPED_COLLECTIONS) {
      await app.db.collection(name).deleteMany({ userId });
    }
    await app.db.collection<WorkspaceDoc>('workspaces').deleteMany({ ownerUserId: userId });
    await app.db.collection<UserDoc>('users').deleteOne({ _id: userId });

    return { deleted: true };
  });

  app.get('/workspaces/current', { preHandler: app.requireAuth }, async (req, reply) => {
    const ws = await app.db
      .collection<WorkspaceDoc>('workspaces')
      .findOne({ _id: req.auth!.workspaceId });
    if (!ws) return reply.code(404).send({ error: 'not_found' });
    return {
      id: ws._id,
      name: ws.name,
      ownerUserId: ws.ownerUserId,
      createdAt: ws.createdAt,
      updatedAt: ws.updatedAt,
    };
  });
}
