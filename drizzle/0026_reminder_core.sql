CREATE TABLE `reminder_endpoints` (
  `id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
  `user_id` integer NOT NULL REFERENCES `users`(`id`) ON DELETE CASCADE,
  `adapter_key` text NOT NULL,
  `label` text NOT NULL,
  `encrypted_target` text NOT NULL,
  `metadata` text,
  `enabled` integer DEFAULT 1 NOT NULL,
  `last_test_at` text,
  `last_test_status` text,
  `last_test_error` text,
  `created_at` text NOT NULL,
  `updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `task_reminders` (
  `id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
  `user_id` integer NOT NULL REFERENCES `users`(`id`) ON DELETE CASCADE,
  `task_id` integer NOT NULL REFERENCES `tasks`(`id`) ON DELETE CASCADE,
  `endpoint_id` integer NOT NULL REFERENCES `reminder_endpoints`(`id`) ON DELETE CASCADE,
  `anchor` text NOT NULL,
  `offset_minutes` integer NOT NULL,
  `all_day_local_time` text,
  `enabled` integer DEFAULT 1 NOT NULL,
  `created_at` text NOT NULL,
  `updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `reminder_deliveries` (
  `id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
  `user_id` integer NOT NULL REFERENCES `users`(`id`) ON DELETE CASCADE,
  `task_id` integer NOT NULL REFERENCES `tasks`(`id`) ON DELETE CASCADE,
  `task_reminder_id` integer NOT NULL REFERENCES `task_reminders`(`id`) ON DELETE CASCADE,
  `endpoint_id` integer NOT NULL REFERENCES `reminder_endpoints`(`id`) ON DELETE CASCADE,
  `adapter_key` text NOT NULL,
  `dedupe_key` text NOT NULL,
  `scheduled_for` text NOT NULL,
  `status` text DEFAULT 'pending' NOT NULL,
  `attempts` integer DEFAULT 0 NOT NULL,
  `next_attempt_at` text,
  `provider_message_id` text,
  `rendered_body` text,
  `error` text,
  `last_attempt_at` text,
  `sent_at` text,
  `created_at` text NOT NULL,
  `updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `reminder_deliveries_dedupe_key_unique` ON `reminder_deliveries` (`dedupe_key`);
