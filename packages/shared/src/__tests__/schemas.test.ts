import { describe, it, expect } from 'vitest';
import { newUlid, isUlid, UlidSchema } from '../ulid.js';
import { nowUtc, IsoUtc } from '../timestamps.js';
import { Task } from '../schemas/task.js';
import { Event } from '../schemas/event.js';

describe('ulid', () => {
  it('generates valid ulid', () => {
    const id = newUlid();
    expect(id).toHaveLength(26);
    expect(isUlid(id)).toBe(true);
    expect(UlidSchema.safeParse(id).success).toBe(true);
  });
});

describe('timestamps', () => {
  it('nowUtc returns valid ISO', () => {
    const ts = nowUtc();
    expect(IsoUtc.safeParse(ts).success).toBe(true);
    expect(ts.endsWith('Z')).toBe(true);
  });
});

describe('Task schema', () => {
  it('parses minimal task', () => {
    const now = nowUtc();
    const t = Task.parse({
      id: newUlid(),
      workspaceId: newUlid(),
      title: 'test',
      createdAt: now,
      updatedAt: now,
    });
    expect(t.status).toBe('pending');
    expect(t.priority).toBe('medium');
    expect(t.subtasks).toEqual([]);
  });

  it('rejects empty title', () => {
    const now = nowUtc();
    const r = Task.safeParse({
      id: newUlid(),
      workspaceId: newUlid(),
      title: '',
      createdAt: now,
      updatedAt: now,
    });
    expect(r.success).toBe(false);
  });
});

describe('Event schema', () => {
  it('rejects end before start', () => {
    const now = nowUtc();
    const r = Event.safeParse({
      id: newUlid(),
      workspaceId: newUlid(),
      calendarId: newUlid(),
      title: 'x',
      start: '2026-07-03T12:00:00.000Z',
      end: '2026-07-03T11:00:00.000Z',
      createdAt: now,
      updatedAt: now,
    });
    expect(r.success).toBe(false);
  });
});
