ALTER TABLE `users` ADD `calendar_feed_token` text;--> statement-breakpoint
CREATE UNIQUE INDEX `users_calendar_feed_token_unique` ON `users` (`calendar_feed_token`);