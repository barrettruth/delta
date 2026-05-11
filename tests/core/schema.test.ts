import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import { describe, expect, it } from "vitest";
import * as schema from "@/db/schema";

describe("schema migrations", () => {
  it("drops legacy task source columns", () => {
    const sqlite = new Database(":memory:");
    try {
      const db = drizzle(sqlite, { schema });
      migrate(db, { migrationsFolder: "./drizzle" });

      const columns = sqlite.prepare("PRAGMA table_info(tasks)").all() as {
        name: string;
      }[];

      expect(columns.map((column) => column.name)).not.toContain(
        "source_event_id",
      );
      expect(columns.map((column) => column.name)).not.toContain(
        "source_user_id",
      );
    } finally {
      sqlite.close();
    }
  });
});
