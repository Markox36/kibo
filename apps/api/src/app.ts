import Fastify, { type FastifyInstance } from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
import { loadEnv, type Env } from './config/env.js';
import { dbPlugin } from './plugins/db.plugin.js';
import { authPlugin } from './plugins/auth.plugin.js';
import { authRoutes } from './modules/auth/auth.routes.js';
import { userRoutes } from './modules/users/users.routes.js';
import { registerCrudRoutes } from './modules/crud/index.js';
import { syncRoutes } from './modules/sync/sync.routes.js';
import { deviceRoutes } from './modules/devices/devices.routes.js';
import { calendarsImportRoutes } from './modules/calendars-import/import.routes.js';
import { googleIntegrationRoutes } from './modules/integrations/google.routes.js';
import { eventsBulkRoutes } from './modules/events-bulk/bulk.routes.js';
import { adminPlugin } from './modules/admin/admin.plugin.js';
import { adminRoutes } from './modules/admin/admin.routes.js';

export interface BuildOptions {
  env?: Env;
}

export async function buildApp(opts: BuildOptions = {}): Promise<FastifyInstance> {
  const env = opts.env ?? loadEnv();

  const app = Fastify({
    trustProxy: env.TRUST_PROXY,
    logger:
      env.NODE_ENV === 'production'
        ? { level: 'info' }
        : {
            level: 'debug',
            transport: { target: 'pino-pretty', options: { colorize: true } },
          },
    disableRequestLogging: env.NODE_ENV === 'test',
    // Give the db plugin room to surface the real Mongo error (driver waits up
    // to serverSelectionTimeoutMS) instead of avvio's opaque 10s plugin timeout.
    pluginTimeout: 30_000,
  });

  await app.register(helmet, { global: true });
  await app.register(cors, {
    origin: (origin, cb) => {
      if (!origin) return cb(null, true);
      const allowed = [env.WEB_ORIGIN, 'http://localhost:5173', 'http://localhost:1420'];
      if (allowed.includes(origin) || origin.startsWith('tauri://')) return cb(null, true);
      cb(new Error('CORS not allowed'), false);
    },
    credentials: true,
  });
  await app.register(rateLimit, { max: 200, timeWindow: '1 minute' });

  await app.register(dbPlugin, { uri: env.MONGODB_URI, dbName: env.MONGODB_DB_NAME });
  await app.register(authPlugin, {
    secret: env.JWT_SECRET,
    accessExpiresIn: env.JWT_ACCESS_EXPIRES_IN,
    refreshExpiresIn: env.JWT_REFRESH_EXPIRES_IN,
  });
  await app.register(adminPlugin, { env });

  app.get('/health', async () => ({ status: 'ok', now: new Date().toISOString() }));

  await app.register(async (r) => authRoutes(r, env));
  await app.register(async (r) => userRoutes(r, env));
  await app.register(registerCrudRoutes);
  await app.register(async (r) => calendarsImportRoutes(r, env));
  await app.register(async (r) => googleIntegrationRoutes(r, env));
  await app.register(eventsBulkRoutes);
  await app.register(adminRoutes);
  await app.register(syncRoutes);
  await app.register(deviceRoutes);

  return app;
}
