import { z } from 'zod';
import { UlidSchema } from '../ulid.js';
import { IsoUtc } from '../timestamps.js';
import { DevicePlatform } from '../enums.js';

export const Device = z.object({
  id: UlidSchema,
  userId: UlidSchema,
  workspaceId: UlidSchema,
  deviceName: z.string().min(1).max(200),
  platform: DevicePlatform,
  appVersion: z.string().max(50),
  lastSyncAt: IsoUtc.nullable().optional(),
  lastSyncCursor: UlidSchema.nullable().optional(),
  createdAt: IsoUtc,
  updatedAt: IsoUtc,
});
export type Device = z.infer<typeof Device>;
