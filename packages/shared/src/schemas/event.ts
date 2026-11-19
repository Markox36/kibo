import { z } from 'zod';
import { UlidSchema } from '../ulid.js';
import { IsoUtc } from '../timestamps.js';
import { Reminder } from '../enums.js';
import { BaseEntity } from './base.js';

export const Event = BaseEntity.extend({
  calendarId: UlidSchema,
  title: z.string().min(1).max(500),
  description: z.string().max(20_000).nullable().optional(),
  start: IsoUtc,
  end: IsoUtc,
  allDay: z.boolean().default(false),
  categoryId: UlidSchema.nullable().optional(),
  tagIds: z.array(UlidSchema).default([]),
  reminder: Reminder.default('none'),
  location: z.string().max(500).nullable().optional(),
  externalUid: z.string().max(500).nullable().optional(),
  rrule: z.string().max(2000).nullable().optional(),
}).refine((v) => new Date(v.end).getTime() >= new Date(v.start).getTime(), {
  message: 'event end must be >= start',
  path: ['end'],
});
export type Event = z.infer<typeof Event>;

export const EventCreateInput = z.object({
  calendarId: UlidSchema,
  title: z.string().min(1).max(500),
  description: z.string().max(20_000).nullable().optional(),
  start: IsoUtc,
  end: IsoUtc,
  allDay: z.boolean().default(false),
  categoryId: UlidSchema.nullable().optional(),
  tagIds: z.array(UlidSchema).default([]),
  reminder: Reminder.default('none'),
  location: z.string().max(500).nullable().optional(),
  externalUid: z.string().max(500).nullable().optional(),
  rrule: z.string().max(2000).nullable().optional(),
});
export type EventCreateInput = z.infer<typeof EventCreateInput>;

export const EventUpdateInput = EventCreateInput.partial();
export type EventUpdateInput = z.infer<typeof EventUpdateInput>;
