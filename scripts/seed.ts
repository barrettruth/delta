import { randomBytes } from "node:crypto";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import * as schema from "../src/db/schema";
import { users } from "../src/db/schema";

const dbPath = process.env.DATABASE_URL ?? "./data/delta.db";
mkdirSync(dirname(dbPath), { recursive: true });
const username = process.argv[2];

if (!username) {
  console.error("Usage: npx tsx scripts/seed.ts <username>");
  process.exit(1);
}

const sqlite = new Database(dbPath);
sqlite.pragma("journal_mode = WAL");
sqlite.pragma("foreign_keys = ON");
const db = drizzle(sqlite, { schema });

migrate(db, { migrationsFolder: "./drizzle" });

const user = db
  .insert(users)
  .values({
    username,
    passwordHash: null,
    apiKey: randomBytes(32).toString("hex"),
    createdAt: new Date().toISOString(),
  })
  .returning()
  .get();

console.log(`Created user "${user.username}" (id: ${user.id})`);
console.log(`API key: ${user.apiKey}`);

sqlite.close();
