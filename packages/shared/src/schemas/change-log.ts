import { z } from 'zod';
import { UlidSchema } from '../ulid.js';
import { IsoUtc } from '../timestamps.js';
import { SyncOperation } from '../enums.js';

export const EntityType = z.enum([
  'task',
  'event',
  'calendar',
  'category',
  'tag',
  'inbox',
  'time_entry',
]);
export type EntityType = z.infer<typeof EntityType>;

export const ChangeLogEntry = z.object({
  id: UlidSchema,
  workspaceId: UlidSchema,
  entityType: EntityType,
  entityId: UlidSchema,
  operation: SyncOperation,
  changedAt: IsoUtc,
  version: z.number().int().positive(),
  actorUserId: UlidSchema,
  payloadSnapshot: z.record(z.unknown()),
});
export type ChangeLogEntry = z.infer<typeof ChangeLogEntry>;
