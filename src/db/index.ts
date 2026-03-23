import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import type { BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import * as schema from "./schema";

let _db: BetterSQLite3Database<typeof schema> | null = null;

function createDb(): BetterSQLite3Database<typeof schema> {
  const sqlite = new Database(process.env.DATABASE_URL ?? "./data/delta.db");
  sqlite.pragma("journal_mode = WAL");
  sqlite.pragma("foreign_keys = ON");
  return drizzle(sqlite, { schema });
}

export const db = new Proxy({} as BetterSQLite3Database<typeof schema>, {
  get(_target, prop, receiver) {
    if (!_db) {
      _db = createDb();
    }
    return Reflect.get(_db, prop, receiver);
  },
});
