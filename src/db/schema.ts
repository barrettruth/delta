import { sql } from "drizzle-orm";
import {
  integer,
  primaryKey,
  real,
  sqliteTable,
  text,
  unique,
} from "drizzle-orm/sqlite-core";
import type { ExternalLinkProviderId } from "@/core/external-link-providers";

export const users = sqliteTable("users", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  username: text("username").notNull().unique(),
  apiKey: text("api_key").notNull().unique(),
  calendarFeedToken: text("calendar_feed_token").unique(),
  createdAt: text("created_at").notNull(),
});

export const tasks = sqliteTable("tasks", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userId: integer("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  description: text("description").notNull(),
  status: text("status", {
    enum: ["pending", "done", "wip", "blocked", "cancelled"],
  })
    .notNull()
    .default("pending"),
  category: text("category").default("Todo"),
  due: text("due"),
  recurrence: text("recurrence"),
  recurMode: text("recur_mode", { enum: ["scheduled", "completion"] }),
  notes: text("notes"),
  order: integer("order").default(0),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
  startAt: text("start_at"),
  endAt: text("end_at"),
  allDay: integer("all_day").default(0),
  timezone: text("timezone"),
  completedAt: text("completed_at"),
  location: text("location"),
  locationLat: real("location_lat"),
  locationLon: real("location_lon"),
  meetingUrl: text("meeting_url"),
  exdates: text("exdates"),
  rdates: text("rdates"),
  recurringTaskId: integer("recurring_task_id"),
  originalStartAt: text("original_start_at"),
});

export const taskExternalLinks = sqliteTable(
  "task_external_links",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    taskId: integer("task_id")
      .notNull()
      .references(() => tasks.id, { onDelete: "cascade" }),
    provider: text("provider").$type<ExternalLinkProviderId>().notNull(),
    externalId: text("external_id").notNull(),
    metadata: text("metadata"),
    lastSyncedAt: text("last_synced_at"),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull(),
  },
  (t) => [
    unique().on(t.taskId, t.provider),
    unique().on(t.userId, t.provider, t.externalId),
  ],
);

export const taskDependencies = sqliteTable(
  "task_dependencies",
  {
    taskId: integer("task_id")
      .notNull()
      .references(() => tasks.id, { onDelete: "cascade" }),
    dependsOnId: integer("depends_on_id")
      .notNull()
      .references(() => tasks.id, { onDelete: "cascade" }),
  },
  (t) => [primaryKey({ columns: [t.taskId, t.dependsOnId] })],
);

export const categoryColors = sqliteTable(
  "category_colors",
  {
    userId: integer("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    category: text("category").notNull(),
    color: text("color").notNull(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.category] })],
);

export const userSettings = sqliteTable("user_settings", {
  userId: integer("user_id")
    .primaryKey()
    .references(() => users.id, { onDelete: "cascade" }),
  settings: text("settings").notNull(),
});

export const integrationConfigs = sqliteTable(
  "integration_configs",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    provider: text("provider").notNull(),
    encryptedTokens: text("encrypted_tokens").notNull(),
    metadata: text("metadata"),
    enabled: integer("enabled").notNull().default(1),
    createdAt: text("created_at").notNull().default(sql`(current_timestamp)`),
    updatedAt: text("updated_at").notNull().default(sql`(current_timestamp)`),
  },
  (t) => [unique().on(t.userId, t.provider)],
);
