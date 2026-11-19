import fp from 'fastify-plugin';
import { MongoClient, type Db } from 'mongodb';
import type { FastifyInstance } from 'fastify';

declare module 'fastify' {
  interface FastifyInstance {
    mongo: MongoClient;
    db: Db;
  }
}

interface Opts {
  uri: string;
  dbName: string;
}

export const dbPlugin = fp<Opts>(async (app: FastifyInstance, opts) => {
  const client = new MongoClient(opts.uri, {
    maxPoolSize: 20,
    serverSelectionTimeoutMS: 10_000,
  });
  await client.connect();
  const db = client.db(opts.dbName);

  app.decorate('mongo', client);
  app.decorate('db', db);

  app.addHook('onClose', async () => {
    await client.close();
  });

  await ensureIndexes(db);
});

async function ensureIndexes(db: Db): Promise<void> {
  await Promise.all([
    db.collection('users').createIndex({ email: 1 }, { unique: true }),
    db.collection('users').createIndex({ googleId: 1 }, { sparse: true }),
    db.collection('workspaces').createIndex({ ownerUserId: 1 }),
    db.collection('refresh_tokens').createIndex({ userId: 1 }),
    db.collection('refresh_tokens').createIndex({ tokenHash: 1 }, { unique: true }),
    db
      .collection('refresh_tokens')
      .createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 }),
    db.collection('email_tokens').createIndex({ tokenHash: 1 }, { unique: true }),
    db.collection('email_tokens').createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 }),
    db.collection('devices').createIndex({ userId: 1 }),
    db.collection('devices').createIndex({ workspaceId: 1 }),
    db.collection('tasks').createIndex({ workspaceId: 1, updatedAt: -1 }),
    db.collection('tasks').createIndex({ workspaceId: 1, status: 1 }),
    db.collection('tasks').createIndex({ workspaceId: 1, plannedDate: 1 }),
    db.collection('events').createIndex({ workspaceId: 1, start: 1 }),
    db.collection('events').createIndex({ workspaceId: 1, calendarId: 1 }),
    db.collection('calendars').createIndex({ workspaceId: 1 }),
    db.collection('categories').createIndex({ workspaceId: 1 }),
    db.collection('tags').createIndex({ workspaceId: 1 }),
    db.collection('inbox').createIndex({ workspaceId: 1, status: 1 }),
    db.collection('time_entries').createIndex({ workspaceId: 1, taskId: 1 }),
    db.collection('change_log').createIndex({ workspaceId: 1, id: 1 }),
    db.collection('change_log').createIndex({ workspaceId: 1, entityType: 1, entityId: 1 }),
    db
      .collection('change_log')
      .createIndex({ changedAt: 1 }, { expireAfterSeconds: 60 * 60 * 24 * 90 }),
  ]);
}
