DROP TABLE IF EXISTS `invite_codes`;--> statement-breakpoint
CREATE TABLE `invite_links` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`token` text NOT NULL,
	`created_by` integer NOT NULL REFERENCES `users`(`id`) ON DELETE CASCADE,
	`expires_at` text NOT NULL,
	`max_uses` integer NOT NULL DEFAULT 1,
	`use_count` integer NOT NULL DEFAULT 0,
	`used_by` integer REFERENCES `users`(`id`),
	`used_at` text,
	`created_at` text NOT NULL
);--> statement-breakpoint
CREATE UNIQUE INDEX `invite_links_token_unique` ON `invite_links` (`token`);
