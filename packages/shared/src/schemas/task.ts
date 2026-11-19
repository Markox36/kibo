import { z } from 'zod';
import { UlidSchema } from '../ulid.js';
import { IsoUtc, IsoDateOnly } from '../timestamps.js';
import {
  TaskStatus,
  Priority,
  Energy,
  TimeBlock,
  Recurrence,
  Reminder,
} from '../enums.js';
import { BaseEntity } from './base.js';

export const Subtask = z.object({
  id: UlidSchema,
  text: z.string().min(1).max(500),
  done: z.boolean().default(false),
  order: z.number().int().nonnegative(),
});
export type Subtask = z.infer<typeof Subtask>;

export const Task = BaseEntity.extend({
  title: z.string().min(1).max(500),
  description: z.string().max(20_000).nullable().optional(),
  status: TaskStatus.default('pending'),
  priority: Priority.default('medium'),
  energy: Energy.nullable().optional(),
  categoryId: UlidSchema.nullable().optional(),
  tagIds: z.array(UlidSchema).default([]),
  plannedDate: IsoDateOnly.nullable().optional(),
  plannedStart: IsoUtc.nullable().optional(),
  plannedEnd: IsoUtc.nullable().optional(),
  timeBlock: TimeBlock.nullable().optional(),
  dueDate: IsoDateOnly.nullable().optional(),
  estimatedMinutes: z.number().int().positive().nullable().optional(),
  recurrence: Recurrence.default('none'),
  reminder: Reminder.default('none'),
  subtasks: z.array(Subtask).default([]),
});
export type Task = z.infer<typeof Task>;

export const TaskCreateInput = Task.omit({
  id: true,
  workspaceId: true,
  createdAt: true,
  updatedAt: true,
  deletedAt: true,
  version: true,
  syncStatus: true,
});
export type TaskCreateInput = z.infer<typeof TaskCreateInput>;

export const TaskUpdateInput = TaskCreateInput.partial();
export type TaskUpdateInput = z.infer<typeof TaskUpdateInput>;
