import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import { describe, expect, it } from "vitest";
import * as schema from "@/db/schema";

describe("schema migrations", () => {
  const currentTables = [
    "category_colors",
    "integration_configs",
    "task_dependencies",
    "task_external_links",
    "tasks",
    "user_settings",
    "users",
  ];

  const retiredTables = [
    "accounts",
    "automations",
    "event_share_links",
    "invite_codes",
    "invite_links",
    "recovery_codes",
    "reminder_deliveries",
    "reminder_endpoints",
    "sessions",
    "system_configs",
    "task_reminders",
    "webauthn_credentials",
  ];

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
    return tables
      .map((table) => table.name)
      .filter((name) => !name.startsWith("__drizzle_"))
      .filter((name) => name !== "sqlite_sequence")
      .sort();
  }

  function tableColumns(sqlite: Database.Database, table: string) {
    return sqlite.prepare(`PRAGMA table_info(${table})`).all() as {
      name: string;
      notnull: number;
    }[];
  }

  function columnNames(sqlite: Database.Database, table: string): string[] {
    return tableColumns(sqlite, table).map((column) => column.name);
  }

  function createRetiredTables(sqlite: Database.Database) {
    for (const table of retiredTables) {
      sqlite.exec(
        `CREATE TABLE "${table}" ("id" integer PRIMARY KEY AUTOINCREMENT NOT NULL);`,
      );
    }
  }

  function createDeployedSchemaBeforeCompaction(sqlite: Database.Database) {
    sqlite.exec(`
      CREATE TABLE "__drizzle_migrations" (
        id SERIAL PRIMARY KEY,
        hash text NOT NULL,
        created_at numeric
      );
      INSERT INTO "__drizzle_migrations" ("hash", "created_at")
      VALUES ('deployed-0031', 1778529940962);

      CREATE TABLE "users" (
        "id" integer PRIMARY KEY AUTOINCREMENT NOT NULL,
        "username" text NOT NULL,
        "password_hash" text,
        "api_key" text,
        "calendar_feed_token" text,
        "totp_secret" text,
        "totp_enabled" integer DEFAULT 0,
        "keymap_overrides" text,
        "onboarding_completed" integer DEFAULT 0,
        "created_at" text NOT NULL
      );
      CREATE UNIQUE INDEX "users_username_unique" ON "users" ("username");
      CREATE UNIQUE INDEX "users_api_key_unique" ON "users" ("api_key");
      CREATE UNIQUE INDEX "users_calendar_feed_token_unique"
        ON "users" ("calendar_feed_token");
      INSERT INTO "users" (
        "id",
        "username",
        "password_hash",
        "api_key",
        "calendar_feed_token",
        "created_at"
      )
      VALUES
        (1, 'owner', 'retired-password-hash', NULL, 'feed-token', '2026-05-11T00:00:00.000Z');

      CREATE TABLE "tasks" (
        "id" integer PRIMARY KEY AUTOINCREMENT NOT NULL,
        "user_id" integer NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
        "description" text NOT NULL,
        "status" text DEFAULT 'pending' NOT NULL,
        "category" text DEFAULT 'Todo',
        "due" text,
        "recurrence" text,
        "recur_mode" text,
        "notes" text,
        "order" integer DEFAULT 0,
        "created_at" text NOT NULL,
        "updated_at" text NOT NULL,
        "start_at" text,
        "end_at" text,
        "all_day" integer DEFAULT 0,
        "timezone" text,
        "completed_at" text,
        "location" text,
        "location_lat" real,
        "location_lon" real,
        "meeting_url" text,
        "exdates" text,
        "rdates" text,
        "recurring_task_id" integer,
        "original_start_at" text
      );
      INSERT INTO "tasks" (
        "id",
        "user_id",
        "description",
        "created_at",
        "updated_at",
        "location",
        "location_lat",
        "location_lon"
      )
      VALUES (
        1,
        1,
        'Preserve calendar task',
        '2026-05-11T00:00:00.000Z',
        '2026-05-11T00:00:00.000Z',
        'Charlottesville',
        38.03,
        -78.48
      );

      CREATE TABLE "task_dependencies" (
        "task_id" integer NOT NULL REFERENCES "tasks"("id") ON DELETE CASCADE,
        "depends_on_id" integer NOT NULL REFERENCES "tasks"("id") ON DELETE CASCADE,
        PRIMARY KEY("task_id", "depends_on_id")
      );
      CREATE TABLE "category_colors" (
        "user_id" integer NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
        "category" text NOT NULL,
        "color" text NOT NULL,
        PRIMARY KEY("user_id", "category")
      );
      INSERT INTO "category_colors" ("user_id", "category", "color")
      VALUES (1, 'Todo', '#ffffff');

      CREATE TABLE "user_settings" (
        "user_id" integer PRIMARY KEY NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
        "settings" text NOT NULL
      );
      INSERT INTO "user_settings" ("user_id", "settings")
      VALUES (1, '{"view":"calendar"}');

      CREATE TABLE "integration_configs" (
        "id" integer PRIMARY KEY AUTOINCREMENT NOT NULL,
        "user_id" integer NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
        "provider" text NOT NULL,
        "encrypted_tokens" text NOT NULL,
        "metadata" text,
        "enabled" integer DEFAULT 1 NOT NULL,
        "created_at" text DEFAULT (current_timestamp) NOT NULL,
        "updated_at" text DEFAULT (current_timestamp) NOT NULL
      );
      CREATE UNIQUE INDEX "integration_configs_user_id_provider_unique"
        ON "integration_configs" ("user_id", "provider");
      INSERT INTO "integration_configs" (
        "id",
        "user_id",
        "provider",
        "encrypted_tokens",
        "metadata",
        "enabled",
        "created_at",
        "updated_at"
      )
      VALUES (
        1,
        1,
        'google_calendar',
        'encrypted-token',
        NULL,
        1,
        '2026-05-11T00:00:00.000Z',
        '2026-05-11T00:00:00.000Z'
      );

      CREATE TABLE "task_external_links" (
        "id" integer PRIMARY KEY AUTOINCREMENT NOT NULL,
        "user_id" integer NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
        "task_id" integer NOT NULL REFERENCES "tasks"("id") ON DELETE CASCADE,
        "provider" text NOT NULL,
        "external_id" text NOT NULL,
        "metadata" text,
        "last_synced_at" text,
        "created_at" text NOT NULL,
        "updated_at" text NOT NULL
      );
      CREATE UNIQUE INDEX "task_external_links_task_id_provider_unique"
        ON "task_external_links" ("task_id", "provider");
      CREATE UNIQUE INDEX "task_external_links_user_id_provider_external_id_unique"
        ON "task_external_links" ("user_id", "provider", "external_id");
      INSERT INTO "task_external_links" (
        "id",
        "user_id",
        "task_id",
        "provider",
        "external_id",
        "created_at",
        "updated_at"
      )
      VALUES (
        1,
        1,
        1,
        'google_tasks',
        'task-external-id',
        '2026-05-11T00:00:00.000Z',
        '2026-05-11T00:00:00.000Z'
      );

    `);
    createRetiredTables(sqlite);
  }

  it("uses a compact current baseline for fresh databases", () => {
    withMigratedSchema((sqlite) => {
      expect(tableNames(sqlite)).toEqual(currentTables);
    });
  });

  it("does not create retired product surfaces for fresh databases", () => {
    withMigratedSchema((sqlite) => {
      const names = tableNames(sqlite);
      const taskColumns = columnNames(sqlite, "tasks");
      const userColumns = columnNames(sqlite, "users");

      for (const table of retiredTables) {
        expect(names).not.toContain(table);
      }

      expect(taskColumns).not.toContain("external_id");
      expect(taskColumns).not.toContain("external_source");
      expect(taskColumns).not.toContain("label");
      expect(taskColumns).not.toContain("priority");
      expect(taskColumns).not.toContain("source_event_id");
      expect(taskColumns).not.toContain("source_user_id");
      expect(userColumns).not.toContain("keymap_overrides");
      expect(userColumns).not.toContain("onboarding_completed");
      expect(userColumns).not.toContain("password_hash");
      expect(userColumns).not.toContain("totp_enabled");
      expect(userColumns).not.toContain("totp_secret");
    });
  });

  it("keeps encrypted provider token storage", () => {
    withMigratedSchema((sqlite) => {
      const names = tableNames(sqlite);
      const columns = columnNames(sqlite, "integration_configs");

      expect(names).toContain("integration_configs");
      expect(columns).toContain("encrypted_tokens");
      expect(columns).toContain("provider");
    });
  });

  it("keeps current user and task columns required", () => {
    withMigratedSchema((sqlite) => {
      const userColumns = tableColumns(sqlite, "users");
      const taskColumns = columnNames(sqlite, "tasks");

      expect(
        userColumns.find((column) => column.name === "api_key"),
      ).toMatchObject({ notnull: 1 });
      expect(taskColumns).toContain("location_lat");
      expect(taskColumns).toContain("location_lon");
      expect(taskColumns).toContain("meeting_url");
      expect(taskColumns).toContain("exdates");
      expect(taskColumns).toContain("rdates");
      expect(taskColumns).toContain("original_start_at");
    });
  });

  it("keeps the forward cleanup migration for deployed databases", () => {
    const sqlite = new Database(":memory:");
    try {
      createDeployedSchemaBeforeCompaction(sqlite);
      expect(tableNames(sqlite)).toEqual(expect.arrayContaining(retiredTables));

      const db = drizzle(sqlite, { schema });
      migrate(db, { migrationsFolder: "./drizzle" });

      const names = tableNames(sqlite);
      const user = sqlite
        .prepare(
          `SELECT username, api_key, calendar_feed_token, created_at FROM users WHERE id = 1`,
        )
        .get() as {
        username: string;
        api_key: string;
        calendar_feed_token: string;
        created_at: string;
      };
      const task = sqlite
        .prepare(
          `SELECT description, location, location_lat, location_lon FROM tasks WHERE id = 1`,
        )
        .get();

      for (const table of retiredTables) {
        expect(names).not.toContain(table);
      }
      expect(columnNames(sqlite, "users")).toEqual([
        "id",
        "username",
        "api_key",
        "calendar_feed_token",
        "created_at",
      ]);
      expect(user.username).toBe("owner");
      expect(user.api_key).toMatch(/^[a-f0-9]{64}$/);
      expect(user.calendar_feed_token).toBe("feed-token");
      expect(user.created_at).toBe("2026-05-11T00:00:00.000Z");
      expect(task).toMatchObject({
        description: "Preserve calendar task",
        location: "Charlottesville",
        location_lat: 38.03,
        location_lon: -78.48,
      });
    } finally {
      sqlite.close();
    }
  });
});
