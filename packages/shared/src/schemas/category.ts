import { z } from 'zod';
import { IsoUtc } from '../timestamps.js';
import { BaseEntity, HexColor } from './base.js';

export const Category = BaseEntity.extend({
  name: z.string().min(1).max(200),
  color: HexColor,
  icon: z.string().max(50).nullable().optional(),
  order: z.number().int().nonnegative().default(0),
  archivedAt: IsoUtc.nullable().optional(),
});
export type Category = z.infer<typeof Category>;

export const CategoryCreateInput = z.object({
  name: z.string().min(1).max(200),
  color: HexColor,
  icon: z.string().max(50).nullable().optional(),
  order: z.number().int().nonnegative().default(0),
});
export type CategoryCreateInput = z.infer<typeof CategoryCreateInput>;

export const CategoryUpdateInput = CategoryCreateInput.partial();
export type CategoryUpdateInput = z.infer<typeof CategoryUpdateInput>;
