ALTER TABLE `tasks` ADD `user_id` integer NOT NULL DEFAULT 1 REFERENCES users(id) ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE `automations` ADD `user_id` integer NOT NULL DEFAULT 1 REFERENCES users(id) ON DELETE CASCADE;--> statement-breakpoint
PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_category_colors` (
	`user_id` integer NOT NULL,
	`category` text NOT NULL,
	`color` text NOT NULL,
	PRIMARY KEY(`user_id`, `category`),
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);--> statement-breakpoint
INSERT INTO `__new_category_colors`("user_id", "category", "color") SELECT 1, "category", "color" FROM `category_colors`;--> statement-breakpoint
DROP TABLE `category_colors`;--> statement-breakpoint
ALTER TABLE `__new_category_colors` RENAME TO `category_colors`;--> statement-breakpoint
PRAGMA foreign_keys=ON;
