CREATE TABLE `calendar_feed_tokens` (
	`user_id` integer PRIMARY KEY NOT NULL,
	`token` text NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `calendar_feed_tokens_token_unique` ON `calendar_feed_tokens` (`token`);--> statement-breakpoint
INSERT INTO `calendar_feed_tokens`("user_id", "token", "created_at", "updated_at")
SELECT "id", "calendar_feed_token", "created_at", "created_at" FROM `users`
WHERE "calendar_feed_token" IS NOT NULL;
--> statement-breakpoint
DROP INDEX `users_calendar_feed_token_unique`;--> statement-breakpoint
ALTER TABLE `users` DROP COLUMN `calendar_feed_token`;
