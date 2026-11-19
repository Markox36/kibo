import { z } from 'zod';

export const IsoUtc = z
  .string()
  .datetime({ offset: false, message: 'expected ISO UTC timestamp' });
export type IsoUtc = z.infer<typeof IsoUtc>;

export const nowUtc = (): IsoUtc => new Date().toISOString();

export const toIsoUtc = (d: Date | string | number): IsoUtc => {
  const date = d instanceof Date ? d : new Date(d);
  return date.toISOString();
};

export const IsoDateOnly = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'expected YYYY-MM-DD');
export type IsoDateOnly = z.infer<typeof IsoDateOnly>;
