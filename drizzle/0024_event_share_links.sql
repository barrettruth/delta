CREATE TABLE `event_share_links` (
  `id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
  `token` text NOT NULL,
  `task_id` integer NOT NULL REFERENCES `tasks`(`id`) ON DELETE CASCADE,
  `created_by` integer NOT NULL REFERENCES `users`(`id`) ON DELETE CASCADE,
  `instance_date` text,
  `expires_at` text NOT NULL,
  `created_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `event_share_links_token_unique` ON `event_share_links` (`token`);
--> statement-breakpoint
ALTER TABLE `tasks` ADD `source_event_id` integer;
--> statement-breakpoint
ALTER TABLE `tasks` ADD `source_user_id` integer;
