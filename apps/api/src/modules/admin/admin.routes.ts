import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { readFlags, writeFlags, DEFAULT_FLAGS, publicView } from './flags.service.js';

const FlagsPatch = z.object({
  googleCalendarEnabled: z.boolean().optional(),
  icsFileImportEnabled: z.boolean().optional(),
  icsUrlImportEnabled: z.boolean().optional(),
  registrationEnabled: z.boolean().optional(),
  maintenanceMode: z.boolean().optional(),
  maintenanceMessage: z.string().max(500).nullable().optional(),
  notificationsEnabled: z.boolean().optional(),
  focusEnabled: z.boolean().optional(),
  lofiEnabled: z.boolean().optional(),
  bulkDeleteEnabled: z.boolean().optional(),
  readOnly: z.boolean().optional(),
});

export async function adminRoutes(app: FastifyInstance): Promise<void> {
  app.get('/flags/public', async () => {
    const flags = await readFlags(app.db);
    return publicView(flags);
  });

  app.get(
    '/admin/me',
    { preHandler: [app.requireAuth, app.requireAdmin] },
    async (req) => ({ email: req.adminUser?.email ?? null, id: req.adminUser?.id ?? null }),
  );

  app.get(
    '/admin/flags',
    { preHandler: [app.requireAuth, app.requireAdmin] },
    async () => {
      const flags = await readFlags(app.db);
      return { flags, defaults: DEFAULT_FLAGS };
    },
  );

  app.patch(
    '/admin/flags',
    { preHandler: [app.requireAuth, app.requireAdmin] },
    async (req, reply) => {
      const parsed = FlagsPatch.safeParse(req.body);
      if (!parsed.success)
        return reply.code(400).send({ error: 'bad_input', issues: parsed.error.flatten() });
      const flags = await writeFlags(app.db, parsed.data, req.auth!.sub);
      return { flags };
    },
  );

  app.post(
    '/admin/flags/reset',
    { preHandler: [app.requireAuth, app.requireAdmin] },
    async (req) => {
      const flags = await writeFlags(app.db, DEFAULT_FLAGS, req.auth!.sub);
      return { flags };
    },
  );

  app.get(
    '/admin/stats',
    { preHandler: [app.requireAuth, app.requireAdmin] },
    async () => {
      const [users, events, tasks, calendars, integrations] = await Promise.all([
        app.db.collection('users').countDocuments(),
        app.db.collection('events').countDocuments({ deletedAt: null }),
        app.db.collection('tasks').countDocuments({ deletedAt: null }),
        app.db.collection('calendars').countDocuments({ deletedAt: null }),
        app.db.collection('user_integrations').countDocuments(),
      ]);
      return { users, events, tasks, calendars, integrations };
    },
  );
}
