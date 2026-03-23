import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import { createUser } from "@/core/auth";
import type { Db } from "@/core/types";
import * as schema from "@/db/schema";

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
  return createUser(
    db,
    username ?? `testuser${userCounter}`,
    "testpassword123",
  );
}
