CREATE TABLE `sync_sources` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` integer NOT NULL,
	`provider` text NOT NULL,
	`source_kind` text NOT NULL,
	`source_id` text NOT NULL,
	`title` text NOT NULL,
	`enabled` integer DEFAULT 1 NOT NULL,
	`read_only` integer DEFAULT 1 NOT NULL,
	`default_category` text,
	`sync_cursor` text,
	`last_synced_at` text,
	`last_result` text,
	`last_error` text,
	`metadata` text,
	`created_at` text DEFAULT (current_timestamp) NOT NULL,
	`updated_at` text DEFAULT (current_timestamp) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `sync_sources_user_id_provider_source_kind_source_id_unique` ON `sync_sources` (`user_id`,`provider`,`source_kind`,`source_id`);--> statement-breakpoint
ALTER TABLE `task_external_links` ADD `sync_source_id` integer REFERENCES `sync_sources`(`id`) ON DELETE set null;
