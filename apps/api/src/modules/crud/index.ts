import type { FastifyInstance } from 'fastify';
import {
  TaskCreateInput,
  TaskUpdateInput,
  EventCreateInput,
  EventUpdateInput,
  CalendarCreateInput,
  CalendarUpdateInput,
  CategoryCreateInput,
  CategoryUpdateInput,
  TagCreateInput,
  TagUpdateInput,
  InboxCreateInput,
  InboxUpdateInput,
  TimeEntryCreateInput,
  TimeEntryUpdateInput,
} from '@kibo/shared';
import { crudRoutes } from './crud.factory.js';

export async function registerCrudRoutes(app: FastifyInstance): Promise<void> {
  await app.register(
    crudRoutes({
      path: '/tasks',
      collection: 'tasks',
      entityType: 'task',
      createSchema: TaskCreateInput,
      updateSchema: TaskUpdateInput,
    }),
  );
  await app.register(
    crudRoutes({
      path: '/events',
      collection: 'events',
      entityType: 'event',
      createSchema: EventCreateInput,
      updateSchema: EventUpdateInput,
    }),
  );
  await app.register(
    crudRoutes({
      path: '/calendars',
      collection: 'calendars',
      entityType: 'calendar',
      createSchema: CalendarCreateInput,
      updateSchema: CalendarUpdateInput,
    }),
  );
  await app.register(
    crudRoutes({
      path: '/categories',
      collection: 'categories',
      entityType: 'category',
      createSchema: CategoryCreateInput,
      updateSchema: CategoryUpdateInput,
    }),
  );
  await app.register(
    crudRoutes({
      path: '/tags',
      collection: 'tags',
      entityType: 'tag',
      createSchema: TagCreateInput,
      updateSchema: TagUpdateInput,
    }),
  );
  await app.register(
    crudRoutes({
      path: '/inbox',
      collection: 'inbox',
      entityType: 'inbox',
      createSchema: InboxCreateInput,
      updateSchema: InboxUpdateInput,
    }),
  );
  await app.register(
    crudRoutes({
      path: '/time-entries',
      collection: 'time_entries',
      entityType: 'time_entry',
      createSchema: TimeEntryCreateInput,
      updateSchema: TimeEntryUpdateInput,
    }),
  );
}
