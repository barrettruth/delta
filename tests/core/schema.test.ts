import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import { describe, expect, it } from "vitest";
import * as schema from "@/db/schema";

describe("schema migrations", () => {
  function withMigratedSchema(test: (sqlite: Database.Database) => void) {
    const sqlite = new Database(":memory:");
    try {
      const db = drizzle(sqlite, { schema });
      migrate(db, { migrationsFolder: "./drizzle" });
      test(sqlite);
    } finally {
      sqlite.close();
    }
  }

  it("drops legacy task source columns", () => {
    withMigratedSchema((sqlite) => {
      const columns = sqlite.prepare("PRAGMA table_info(tasks)").all() as {
        name: string;
      }[];

      expect(columns.map((column) => column.name)).not.toContain(
        "source_event_id",
      );
      expect(columns.map((column) => column.name)).not.toContain(
        "source_user_id",
      );
    });
  });

  it("drops retired reminder tables", () => {
    withMigratedSchema((sqlite) => {
      const tables = sqlite
        .prepare("SELECT name FROM sqlite_schema WHERE type = 'table'")
        .all() as { name: string }[];
      const tableNames = tables.map((table) => table.name);

      expect(tableNames).not.toContain("reminder_endpoints");
      expect(tableNames).not.toContain("task_reminders");
      expect(tableNames).not.toContain("reminder_deliveries");
    });
  });
});
