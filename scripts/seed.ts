import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import { createUser } from "../src/core/auth";
import * as schema from "../src/db/schema";

const dbPath = process.env.DATABASE_URL ?? "./data/delta.db";
const username = process.argv[2];
const password = process.argv[3];

if (!username || !password) {
  console.error("Usage: npx tsx scripts/seed.ts <username> <password>");
  process.exit(1);
}

const sqlite = new Database(dbPath);
sqlite.pragma("journal_mode = WAL");
sqlite.pragma("foreign_keys = ON");
const db = drizzle(sqlite, { schema });

migrate(db, { migrationsFolder: "./drizzle" });

const user = createUser(db, username, password);
console.log(`Created user "${user.username}" (id: ${user.id})`);
console.log(`API key: ${user.apiKey}`);

sqlite.close();
