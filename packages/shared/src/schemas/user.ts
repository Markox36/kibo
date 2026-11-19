import { z } from 'zod';
import { UlidSchema } from '../ulid.js';
import { IsoUtc } from '../timestamps.js';

export const User = z.object({
  id: UlidSchema,
  email: z.string().email(),
  name: z.string().max(200).nullable().optional(),
  emailVerifiedAt: IsoUtc.nullable().optional(),
  googleId: z.string().max(200).nullable().optional(),
  createdAt: IsoUtc,
  updatedAt: IsoUtc,
});
export type User = z.infer<typeof User>;

export const Workspace = z.object({
  id: UlidSchema,
  ownerUserId: UlidSchema,
  name: z.string().min(1).max(200),
  createdAt: IsoUtc,
  updatedAt: IsoUtc,
});
export type Workspace = z.infer<typeof Workspace>;

export const PublicUser = User.omit({ googleId: true });
export type PublicUser = z.infer<typeof PublicUser>;
