import { z } from 'zod';
import { UlidSchema } from '../ulid.js';
import { IsoDateOnly } from '../timestamps.js';
import { InboxType, InboxItemStatus } from '../enums.js';
import { BaseEntity } from './base.js';

export const InboxItem = BaseEntity.extend({
  text: z.string().min(1).max(5000),
  type: InboxType.nullable().optional(),
  categoryId: UlidSchema.nullable().optional(),
  tagIds: z.array(UlidSchema).default([]),
  dateHint: IsoDateOnly.nullable().optional(),
  status: InboxItemStatus.default('pending'),
});
export type InboxItem = z.infer<typeof InboxItem>;

export const InboxCreateInput = z.object({
  text: z.string().min(1).max(5000),
  type: InboxType.nullable().optional(),
  categoryId: UlidSchema.nullable().optional(),
  tagIds: z.array(UlidSchema).default([]),
  dateHint: IsoDateOnly.nullable().optional(),
});
export type InboxCreateInput = z.infer<typeof InboxCreateInput>;

export const InboxUpdateInput = InboxCreateInput.partial().extend({
  status: InboxItemStatus.optional(),
});
export type InboxUpdateInput = z.infer<typeof InboxUpdateInput>;
