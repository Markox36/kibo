import type { Db } from 'mongodb';
import { newMonotonicUlid, nowUtc } from '@kibo/shared';
import type { EntityType, SyncOperation, ChangeLogEntry } from '@kibo/shared';
import { coll } from '../../utils/collections.js';

type ChangeLogDoc = ChangeLogEntry & { _id: string };

export class ChangeLogService {
  constructor(private readonly db: Db) {}

  async record(input: {
    workspaceId: string;
    entityType: EntityType;
    entityId: string;
    operation: SyncOperation;
    version: number;
    actorUserId: string;
    payloadSnapshot: Record<string, unknown>;
  }): Promise<ChangeLogEntry> {
    const entry: ChangeLogEntry = {
      id: newMonotonicUlid(),
      workspaceId: input.workspaceId,
      entityType: input.entityType,
      entityId: input.entityId,
      operation: input.operation,
      changedAt: nowUtc(),
      version: input.version,
      actorUserId: input.actorUserId,
      payloadSnapshot: input.payloadSnapshot,
    };
    await coll<ChangeLogDoc>(this.db, 'change_log').insertOne({ _id: entry.id, ...entry });
    return entry;
  }

  async since(
    workspaceId: string,
    cursor: string | null,
    limit = 500,
  ): Promise<ChangeLogEntry[]> {
    const filter: Record<string, unknown> = { workspaceId };
    if (cursor) filter._id = { $gt: cursor };
    const docs = await coll<ChangeLogDoc>(this.db, 'change_log')
      .find(filter)
      .sort({ _id: 1 })
      .limit(limit)
      .toArray();
    return docs.map((d) => {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { _id, ...rest } = d as Record<string, unknown>;
      return rest as unknown as ChangeLogEntry;
    });
  }
}
