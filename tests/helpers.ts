import { randomBytes } from "node:crypto";
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import type { Db } from "@/core/types";
import * as schema from "@/db/schema";
import { users } from "@/db/schema";

export function createTestDb() {
  const sqlite = new Database(":memory:");
  sqlite.pragma("foreign_keys = ON");
  const db = drizzle(sqlite, { schema });
  migrate(db, { migrationsFolder: "./drizzle" });
  return db;
}

let userCounter = 0;

export function createTestUser(db: Db, username?: string) {
  userCounter++;
  const user = db
    .insert(users)
    .values({
      username: username ?? `testuser${userCounter}`,
      passwordHash: null,
      apiKey: randomBytes(32).toString("hex"),
      createdAt: new Date().toISOString(),
    })
    .returning()
    .get();
  const { passwordHash: _, ...safe } = user;
  return safe;
}
