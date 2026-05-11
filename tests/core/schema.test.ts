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

  function tableNames(sqlite: Database.Database): string[] {
    const tables = sqlite
      .prepare("SELECT name FROM sqlite_schema WHERE type = 'table'")
      .all() as { name: string }[];
    return tables.map((table) => table.name);
  }

  function tableColumns(sqlite: Database.Database, table: string) {
    return sqlite.prepare(`PRAGMA table_info(${table})`).all() as {
      name: string;
      notnull: number;
    }[];
  }

  it("drops legacy task source columns", () => {
    withMigratedSchema((sqlite) => {
      const columns = tableColumns(sqlite, "tasks");

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
      const names = tableNames(sqlite);

      expect(names).not.toContain("reminder_endpoints");
      expect(names).not.toContain("task_reminders");
      expect(names).not.toContain("reminder_deliveries");
    });
  });

  it("drops retired app auth schema", () => {
    withMigratedSchema((sqlite) => {
      const names = tableNames(sqlite);
      const userColumns = tableColumns(sqlite, "users");
      const columnNames = userColumns.map((column) => column.name);

      expect(names).not.toContain("accounts");
      expect(names).not.toContain("recovery_codes");
      expect(names).not.toContain("webauthn_credentials");
      expect(names).not.toContain("sessions");
      expect(columnNames).not.toContain("password_hash");
      expect(columnNames).not.toContain("totp_secret");
      expect(columnNames).not.toContain("totp_enabled");
      expect(
        userColumns.find((column) => column.name === "api_key"),
      ).toMatchObject({ notnull: 1 });
    });
  });

  it("keeps encrypted provider token storage", () => {
    withMigratedSchema((sqlite) => {
      const names = tableNames(sqlite);
      const columnNames = tableColumns(sqlite, "integration_configs").map(
        (column) => column.name,
      );

      expect(names).toContain("integration_configs");
      expect(columnNames).toContain("encrypted_tokens");
      expect(columnNames).toContain("provider");
    });
  });
});
