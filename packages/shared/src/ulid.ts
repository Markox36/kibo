import { ulid, monotonicFactory } from 'ulid';
import { z } from 'zod';

export const newUlid = (): string => ulid();

const monotonic = monotonicFactory();
export const newMonotonicUlid = (): string => monotonic();

export const UlidSchema = z
  .string()
  .length(26)
  .regex(/^[0-9A-HJKMNP-TV-Z]{26}$/, 'invalid ULID');
export type Ulid = z.infer<typeof UlidSchema>;

export const isUlid = (v: unknown): v is Ulid => UlidSchema.safeParse(v).success;
