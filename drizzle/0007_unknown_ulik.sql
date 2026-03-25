ALTER TABLE `tasks` ADD `start_at` text;--> statement-breakpoint
ALTER TABLE `tasks` ADD `end_at` text;--> statement-breakpoint
ALTER TABLE `tasks` ADD `all_day` integer DEFAULT 0;--> statement-breakpoint
ALTER TABLE `tasks` ADD `timezone` text;