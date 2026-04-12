CREATE TABLE `task_external_links` (
  `id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
  `user_id` integer NOT NULL REFERENCES `users`(`id`) ON DELETE CASCADE,
  `task_id` integer NOT NULL REFERENCES `tasks`(`id`) ON DELETE CASCADE,
  `provider` text NOT NULL,
  `external_id` text NOT NULL,
  `metadata` text,
  `last_synced_at` text,
  `created_at` text NOT NULL,
  `updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `task_external_links_task_id_provider_unique` ON `task_external_links` (`task_id`,`provider`);
--> statement-breakpoint
CREATE UNIQUE INDEX `task_external_links_user_id_provider_external_id_unique` ON `task_external_links` (`user_id`,`provider`,`external_id`);
