import { z } from 'zod';
import { UlidSchema } from '../ulid.js';
import { IsoUtc } from '../timestamps.js';
import { SyncStatus } from '../enums.js';

export const BaseEntity = z.object({
  id: UlidSchema,
  workspaceId: UlidSchema,
  createdAt: IsoUtc,
  updatedAt: IsoUtc,
  deletedAt: IsoUtc.nullable().optional(),
  version: z.number().int().nonnegative().default(1),
  syncStatus: SyncStatus.default('synced'),
});
export type BaseEntity = z.infer<typeof BaseEntity>;

export const HexColor = z
  .string()
  .regex(/^#([0-9A-Fa-f]{3}|[0-9A-Fa-f]{6}|[0-9A-Fa-f]{8})$/, 'expected hex color');
export type HexColor = z.infer<typeof HexColor>;
