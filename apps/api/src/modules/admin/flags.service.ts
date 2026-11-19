import type { Db } from 'mongodb';
import { nowUtc } from '@kibo/shared';
import { coll } from '../../utils/collections.js';

export interface FeatureFlags {
  googleCalendarEnabled: boolean;
  icsFileImportEnabled: boolean;
  icsUrlImportEnabled: boolean;
  registrationEnabled: boolean;
  maintenanceMode: boolean;
  maintenanceMessage: string | null;
  notificationsEnabled: boolean;
  focusEnabled: boolean;
  lofiEnabled: boolean;
  bulkDeleteEnabled: boolean;
  readOnly: boolean;
}

export const DEFAULT_FLAGS: FeatureFlags = {
  googleCalendarEnabled: true,
  icsFileImportEnabled: true,
  icsUrlImportEnabled: true,
  registrationEnabled: true,
  maintenanceMode: false,
  maintenanceMessage: null,
  notificationsEnabled: true,
  focusEnabled: true,
  lofiEnabled: true,
  bulkDeleteEnabled: true,
  readOnly: false,
};

interface FlagsDoc {
  _id: 'global';
  flags: FeatureFlags;
  updatedAt: string;
  updatedBy: string | null;
}

let cache: { flags: FeatureFlags; expiresAt: number } | null = null;
const CACHE_TTL = 10_000;

export async function readFlags(db: Db): Promise<FeatureFlags> {
  const now = Date.now();
  if (cache && cache.expiresAt > now) return cache.flags;
  const doc = await coll<FlagsDoc>(db, 'feature_flags').findOne({ _id: 'global' });
  const flags = doc ? { ...DEFAULT_FLAGS, ...doc.flags } : DEFAULT_FLAGS;
  cache = { flags, expiresAt: now + CACHE_TTL };
  return flags;
}

export async function writeFlags(
  db: Db,
  patch: Partial<FeatureFlags>,
  actorUserId: string,
): Promise<FeatureFlags> {
  const current = await readFlags(db);
  const merged: FeatureFlags = { ...current, ...patch };
  await coll<FlagsDoc>(db, 'feature_flags').updateOne(
    { _id: 'global' },
    {
      $set: { flags: merged, updatedAt: nowUtc(), updatedBy: actorUserId },
    },
    { upsert: true },
  );
  cache = { flags: merged, expiresAt: Date.now() + CACHE_TTL };
  return merged;
}

export function invalidateFlagsCache(): void {
  cache = null;
}

/** Public flags exposed to unauthenticated clients — safe subset. */
export function publicView(flags: FeatureFlags): {
  googleCalendarEnabled: boolean;
  icsFileImportEnabled: boolean;
  icsUrlImportEnabled: boolean;
  registrationEnabled: boolean;
  maintenanceMode: boolean;
  maintenanceMessage: string | null;
  notificationsEnabled: boolean;
  focusEnabled: boolean;
  lofiEnabled: boolean;
  bulkDeleteEnabled: boolean;
  readOnly: boolean;
} {
  return { ...flags };
}
