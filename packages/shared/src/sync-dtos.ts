import { z } from 'zod';
import { UlidSchema } from './ulid.js';
import { IsoUtc } from './timestamps.js';
import { SyncOperation } from './enums.js';
import { EntityType, ChangeLogEntry } from './schemas/change-log.js';

export const LocalChange = z.object({
  entityType: EntityType,
  entityId: UlidSchema,
  operation: SyncOperation,
  version: z.number().int().positive(),
  changedAt: IsoUtc,
  payload: z.record(z.unknown()),
});
export type LocalChange = z.infer<typeof LocalChange>;

export const SyncRequest = z.object({
  clientId: UlidSchema,
  cursor: UlidSchema.nullable(),
  changes: z.array(LocalChange).default([]),
});
export type SyncRequest = z.infer<typeof SyncRequest>;

export const SyncConflict = z.object({
  entityType: EntityType,
  entityId: UlidSchema,
  clientVersion: z.number().int(),
  serverVersion: z.number().int(),
  resolution: z.enum(['server_wins', 'client_wins']),
});
export type SyncConflict = z.infer<typeof SyncConflict>;

export const SyncResponse = z.object({
  cursor: UlidSchema.nullable(),
  applied: z.array(
    z.object({
      entityType: EntityType,
      entityId: UlidSchema,
      version: z.number().int(),
    }),
  ),
  remoteChanges: z.array(ChangeLogEntry),
  conflicts: z.array(SyncConflict).default([]),
  fullResyncRequired: z.boolean().default(false),
  serverTime: IsoUtc,
});
export type SyncResponse = z.infer<typeof SyncResponse>;

export const FullSyncSnapshot = z.object({
  cursor: UlidSchema.nullable(),
  serverTime: IsoUtc,
  entities: z.object({
    tasks: z.array(z.record(z.unknown())),
    events: z.array(z.record(z.unknown())),
    calendars: z.array(z.record(z.unknown())),
    categories: z.array(z.record(z.unknown())),
    tags: z.array(z.record(z.unknown())),
    inbox: z.array(z.record(z.unknown())),
    timeEntries: z.array(z.record(z.unknown())),
  }),
});
export type FullSyncSnapshot = z.infer<typeof FullSyncSnapshot>;

export const FULL_RESYNC_REQUIRED = 'FULL_RESYNC_REQUIRED' as const;
