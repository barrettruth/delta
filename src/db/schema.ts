import { sql } from "drizzle-orm";
import {
  integer,
  primaryKey,
  real,
  sqliteTable,
  text,
  unique,
} from "drizzle-orm/sqlite-core";

export const users = sqliteTable("users", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  username: text("username").notNull().unique(),
  passwordHash: text("password_hash"),
  apiKey: text("api_key").unique(),
  totpSecret: text("totp_secret"),
  totpEnabled: integer("totp_enabled").default(0),
  calendarFeedToken: text("calendar_feed_token").unique(),
  keymapOverrides: text("keymap_overrides"),
  onboardingCompleted: integer("onboarding_completed").default(0),
  createdAt: text("created_at").notNull(),
});

export const webauthnCredentials = sqliteTable("webauthn_credentials", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userId: integer("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  credentialId: text("credential_id").notNull().unique(),
  publicKey: text("public_key").notNull(),
  counter: integer("counter").notNull().default(0),
  transports: text("transports"),
  name: text("name").notNull(),
  createdAt: text("created_at").notNull(),
});

export const recoveryCodes = sqliteTable("recovery_codes", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userId: integer("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  codeHash: text("code_hash").notNull(),
  used: integer("used").default(0),
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
  externalId: text("external_id"),
  externalSource: text("external_source"),
  sourceEventId: integer("source_event_id"),
  sourceUserId: integer("source_user_id"),
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
    provider: text("provider").notNull(),
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

export const reminderEndpoints = sqliteTable("reminder_endpoints", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userId: integer("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  adapterKey: text("adapter_key", {
    enum: [
      "sms.twilio",
      "whatsapp.twilio",
      "telegram.bot_api",
      "discord.webhook",
      "slack.webhook",
    ],
  }).notNull(),
  label: text("label").notNull(),
  encryptedTarget: text("encrypted_target").notNull(),
  metadata: text("metadata"),
  enabled: integer("enabled").notNull().default(1),
  lastTestAt: text("last_test_at"),
  lastTestStatus: text("last_test_status", { enum: ["ok", "failed"] }),
  lastTestError: text("last_test_error"),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});

export const taskReminders = sqliteTable("task_reminders", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userId: integer("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  taskId: integer("task_id")
    .notNull()
    .references(() => tasks.id, { onDelete: "cascade" }),
  endpointId: integer("endpoint_id")
    .notNull()
    .references(() => reminderEndpoints.id, { onDelete: "cascade" }),
  anchor: text("anchor", { enum: ["due", "start"] }).notNull(),
  offsetMinutes: integer("offset_minutes").notNull(),
  allDayLocalTime: text("all_day_local_time"),
  enabled: integer("enabled").notNull().default(1),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});

export const reminderDeliveries = sqliteTable(
  "reminder_deliveries",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    taskId: integer("task_id")
      .notNull()
      .references(() => tasks.id, { onDelete: "cascade" }),
    taskReminderId: integer("task_reminder_id")
      .notNull()
      .references(() => taskReminders.id, { onDelete: "cascade" }),
    endpointId: integer("endpoint_id")
      .notNull()
      .references(() => reminderEndpoints.id, { onDelete: "cascade" }),
    adapterKey: text("adapter_key", {
      enum: [
        "sms.twilio",
        "whatsapp.twilio",
        "telegram.bot_api",
        "discord.webhook",
        "slack.webhook",
      ],
    }).notNull(),
    dedupeKey: text("dedupe_key").notNull(),
    scheduledFor: text("scheduled_for").notNull(),
    status: text("status", {
      enum: ["pending", "sending", "sent", "failed", "dead", "suppressed"],
    })
      .notNull()
      .default("pending"),
    attempts: integer("attempts").notNull().default(0),
    nextAttemptAt: text("next_attempt_at"),
    providerMessageId: text("provider_message_id"),
    renderedBody: text("rendered_body"),
    error: text("error"),
    lastAttemptAt: text("last_attempt_at"),
    sentAt: text("sent_at"),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull(),
  },
  (t) => [unique().on(t.dedupeKey)],
);

export const inviteLinks = sqliteTable("invite_links", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  token: text("token").notNull().unique(),
  createdBy: integer("created_by")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  expiresAt: text("expires_at").notNull(),
  maxUses: integer("max_uses").notNull().default(1),
  useCount: integer("use_count").notNull().default(0),
  usedBy: integer("used_by").references(() => users.id),
  usedAt: text("used_at"),
  createdAt: text("created_at").notNull(),
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

export const accounts = sqliteTable(
  "accounts",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    provider: text("provider").notNull(),
    providerAccountId: text("provider_account_id").notNull(),
    accessToken: text("access_token"),
    refreshToken: text("refresh_token"),
    tokenExpiresAt: text("token_expires_at"),
    email: text("email"),
    name: text("name"),
    createdAt: text("created_at").notNull(),
  },
  (t) => [unique().on(t.provider, t.providerAccountId)],
);

export const eventShareLinks = sqliteTable("event_share_links", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  token: text("token").notNull().unique(),
  taskId: integer("task_id")
    .notNull()
    .references(() => tasks.id, { onDelete: "cascade" }),
  createdBy: integer("created_by")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  instanceDate: text("instance_date"),
  expiresAt: text("expires_at").notNull(),
  createdAt: text("created_at").notNull(),
});

export const systemConfigs = sqliteTable("system_configs", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  key: text("key").notNull().unique(),
  value: text("value").notNull(),
  createdAt: text("created_at").notNull().default(sql`(current_timestamp)`),
  updatedAt: text("updated_at").notNull().default(sql`(current_timestamp)`),
});
