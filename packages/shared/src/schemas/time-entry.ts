import { z } from 'zod';
import { UlidSchema } from '../ulid.js';
import { IsoUtc } from '../timestamps.js';
import { TimeEntryType } from '../enums.js';
import { BaseEntity } from './base.js';

export const TimeEntry = BaseEntity.extend({
  taskId: UlidSchema.nullable().optional(),
  startedAt: IsoUtc,
  endedAt: IsoUtc.nullable().optional(),
  durationSeconds: z.number().int().nonnegative().default(0),
  type: TimeEntryType.default('stopwatch'),
  note: z.string().max(2000).nullable().optional(),
});
export type TimeEntry = z.infer<typeof TimeEntry>;

export const TimeEntryCreateInput = z.object({
  taskId: UlidSchema.nullable().optional(),
  startedAt: IsoUtc,
  endedAt: IsoUtc.nullable().optional(),
  durationSeconds: z.number().int().nonnegative().default(0),
  type: TimeEntryType.default('stopwatch'),
  note: z.string().max(2000).nullable().optional(),
});
export type TimeEntryCreateInput = z.infer<typeof TimeEntryCreateInput>;

export const TimeEntryUpdateInput = TimeEntryCreateInput.partial();
export type TimeEntryUpdateInput = z.infer<typeof TimeEntryUpdateInput>;
