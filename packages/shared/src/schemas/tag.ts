import { z } from 'zod';
import { BaseEntity, HexColor } from './base.js';

export const Tag = BaseEntity.extend({
  name: z.string().min(1).max(100),
  color: HexColor,
});
export type Tag = z.infer<typeof Tag>;

export const TagCreateInput = z.object({
  name: z.string().min(1).max(100),
  color: HexColor,
});
export type TagCreateInput = z.infer<typeof TagCreateInput>;

export const TagUpdateInput = TagCreateInput.partial();
export type TagUpdateInput = z.infer<typeof TagUpdateInput>;
