import {
  integer,
  primaryKey,
  sqliteTable,
  text,
} from "drizzle-orm/sqlite-core";

export const users = sqliteTable("users", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  username: text("username").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  apiKey: text("api_key").unique(),
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
  priority: integer("priority").default(0),
  due: text("due"),
  recurrence: text("recurrence"),
  recurMode: text("recur_mode", { enum: ["scheduled", "completion"] }),
  notes: text("notes"),
  order: integer("order").default(0),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
  completedAt: text("completed_at"),
});

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

export const sessions = sqliteTable("sessions", {
  id: text("id").primaryKey(),
  userId: integer("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  expiresAt: text("expires_at").notNull(),
  createdAt: text("created_at").notNull(),
});

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

export const automations = sqliteTable("automations", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userId: integer("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  cron: text("cron").notNull(),
  type: text("type").notNull(),
  config: text("config").notNull(),
  enabled: integer("enabled").default(1),
  lastRunAt: text("last_run_at"),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});
