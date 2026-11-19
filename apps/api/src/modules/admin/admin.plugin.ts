import fp from 'fastify-plugin';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import type { Env } from '../../config/env.js';
import { coll } from '../../utils/collections.js';
import { readFlags, type FeatureFlags } from './flags.service.js';

interface UserDoc {
  _id: string;
  email: string;
  emailLower: string;
}

declare module 'fastify' {
  interface FastifyInstance {
    requireAdmin: (req: FastifyRequest, reply: FastifyReply) => Promise<void>;
    checkFlag: (name: keyof FeatureFlags, reply: FastifyReply) => Promise<boolean>;
    ensureNotReadOnly: (reply: FastifyReply) => Promise<boolean>;
    ensureNotMaintenance: (req: FastifyRequest, reply: FastifyReply) => Promise<boolean>;
  }
  interface FastifyRequest {
    isAdmin?: boolean;
    adminUser?: { id: string; email: string };
  }
}

interface Opts {
  env: Env;
}

export const adminPlugin = fp<Opts>(async (app: FastifyInstance, opts) => {
  const adminEmailLower = opts.env.ADMIN_EMAIL?.toLowerCase();

  const loadAdminStatus = async (req: FastifyRequest): Promise<boolean> => {
    if (!req.auth) return false;
    if (req.isAdmin !== undefined) return req.isAdmin;
    const user = await coll<UserDoc>(app.db, 'users').findOne({ _id: req.auth.sub });
    const isAdmin = Boolean(adminEmailLower && user && user.emailLower === adminEmailLower);
    req.isAdmin = isAdmin;
    if (isAdmin && user) req.adminUser = { id: user._id, email: user.email };
    return isAdmin;
  };

  app.decorate(
    'requireAdmin',
    async (req: FastifyRequest, reply: FastifyReply): Promise<void> => {
      if (!req.auth) {
        reply.code(401).send({ error: 'unauthorized' });
        return;
      }
      const ok = await loadAdminStatus(req);
      if (!ok) {
        reply.code(403).send({ error: 'forbidden' });
      }
    },
  );

  app.decorate(
    'checkFlag',
    async (name: keyof FeatureFlags, reply: FastifyReply): Promise<boolean> => {
      const flags = await readFlags(app.db);
      const value = flags[name];
      if (typeof value === 'boolean' && !value) {
        reply.code(403).send({ error: 'feature_disabled', flag: name });
        return false;
      }
      return true;
    },
  );

  app.decorate(
    'ensureNotReadOnly',
    async (reply: FastifyReply): Promise<boolean> => {
      const flags = await readFlags(app.db);
      if (flags.readOnly) {
        reply.code(403).send({ error: 'read_only_mode' });
        return false;
      }
      return true;
    },
  );

  app.decorate(
    'ensureNotMaintenance',
    async (req: FastifyRequest, reply: FastifyReply): Promise<boolean> => {
      const flags = await readFlags(app.db);
      if (!flags.maintenanceMode) return true;
      const isAdmin = await loadAdminStatus(req);
      if (isAdmin) return true;
      reply.code(503).send({
        error: 'maintenance_mode',
        message: flags.maintenanceMessage ?? 'App en mantenimiento.',
      });
      return false;
    },
  );
});
