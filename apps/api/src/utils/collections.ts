import type { Collection, Db, Document } from 'mongodb';

export type StringIdDoc = { _id: string } & Document;

export function coll<T extends StringIdDoc>(db: Db, name: string): Collection<T> {
  return db.collection(name) as unknown as Collection<T>;
}
