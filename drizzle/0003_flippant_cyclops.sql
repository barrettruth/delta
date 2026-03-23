CREATE TABLE `user_settings` (
	`user_id` integer PRIMARY KEY NOT NULL,
	`settings` text NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
