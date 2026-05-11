CREATE TABLE `category_colors` (
	`user_id` integer NOT NULL,
	`category` text NOT NULL,
	`color` text NOT NULL,
	PRIMARY KEY(`user_id`, `category`),
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `integration_configs` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` integer NOT NULL,
	`provider` text NOT NULL,
	`encrypted_tokens` text NOT NULL,
	`metadata` text,
	`enabled` integer DEFAULT 1 NOT NULL,
	`created_at` text DEFAULT (current_timestamp) NOT NULL,
	`updated_at` text DEFAULT (current_timestamp) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `integration_configs_user_id_provider_unique` ON `integration_configs` (`user_id`,`provider`);--> statement-breakpoint
CREATE TABLE `task_dependencies` (
	`task_id` integer NOT NULL,
	`depends_on_id` integer NOT NULL,
	PRIMARY KEY(`task_id`, `depends_on_id`),
	FOREIGN KEY (`task_id`) REFERENCES `tasks`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`depends_on_id`) REFERENCES `tasks`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `task_external_links` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` integer NOT NULL,
	`task_id` integer NOT NULL,
	`provider` text NOT NULL,
	`external_id` text NOT NULL,
	`metadata` text,
	`last_synced_at` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`task_id`) REFERENCES `tasks`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `task_external_links_task_id_provider_unique` ON `task_external_links` (`task_id`,`provider`);--> statement-breakpoint
CREATE UNIQUE INDEX `task_external_links_user_id_provider_external_id_unique` ON `task_external_links` (`user_id`,`provider`,`external_id`);--> statement-breakpoint
CREATE TABLE `tasks` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` integer NOT NULL,
	`description` text NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`category` text DEFAULT 'Todo',
	`due` text,
	`recurrence` text,
	`recur_mode` text,
	`notes` text,
	`order` integer DEFAULT 0,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`start_at` text,
	`end_at` text,
	`all_day` integer DEFAULT 0,
	`timezone` text,
	`completed_at` text,
	`location` text,
	`location_lat` real,
	`location_lon` real,
	`meeting_url` text,
	`exdates` text,
	`rdates` text,
	`recurring_task_id` integer,
	`original_start_at` text,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `user_settings` (
	`user_id` integer PRIMARY KEY NOT NULL,
	`settings` text NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `users` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`username` text NOT NULL,
	`api_key` text NOT NULL,
	`calendar_feed_token` text,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `users_username_unique` ON `users` (`username`);--> statement-breakpoint
CREATE UNIQUE INDEX `users_api_key_unique` ON `users` (`api_key`);--> statement-breakpoint
CREATE UNIQUE INDEX `users_calendar_feed_token_unique` ON `users` (`calendar_feed_token`);