import { z } from 'zod';
import { IsoUtc } from '../timestamps.js';
import { CalendarType } from '../enums.js';
import { BaseEntity, HexColor } from './base.js';

export const Calendar = BaseEntity.extend({
  name: z.string().min(1).max(200),
  color: HexColor,
  visible: z.boolean().default(true),
  type: CalendarType.default('internal'),
  externalUrl: z.string().url().nullable().optional(),
  externalLastSyncAt: IsoUtc.nullable().optional(),
  order: z.number().int().nonnegative().default(0),
  archivedAt: IsoUtc.nullable().optional(),
  isDefault: z.boolean().default(false),
});
export type Calendar = z.infer<typeof Calendar>;

export const CalendarCreateInput = z.object({
  name: z.string().min(1).max(200),
  color: HexColor,
  visible: z.boolean().default(true),
  type: CalendarType.default('internal'),
  externalUrl: z.string().url().nullable().optional(),
  order: z.number().int().nonnegative().default(0),
  isDefault: z.boolean().default(false),
});
export type CalendarCreateInput = z.infer<typeof CalendarCreateInput>;

export const CalendarUpdateInput = CalendarCreateInput.partial();
export type CalendarUpdateInput = z.infer<typeof CalendarUpdateInput>;
