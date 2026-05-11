-- Retired app-login auth data has been removed. This migration intentionally
-- discards password, TOTP, WebAuthn, recovery, session, and legacy OAuth account data.
DROP TABLE `accounts`;
--> statement-breakpoint
DROP TABLE `recovery_codes`;
--> statement-breakpoint
DROP TABLE `webauthn_credentials`;
--> statement-breakpoint
DROP TABLE `sessions`;
--> statement-breakpoint
PRAGMA foreign_keys=OFF;
--> statement-breakpoint
CREATE TABLE `__new_users` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`username` text NOT NULL,
	`api_key` text NOT NULL,
	`calendar_feed_token` text,
	`created_at` text NOT NULL
);
--> statement-breakpoint
INSERT INTO `__new_users`("id", "username", "api_key", "calendar_feed_token", "created_at")
SELECT "id", "username", COALESCE("api_key", lower(hex(randomblob(32)))), "calendar_feed_token", "created_at" FROM `users`;
--> statement-breakpoint
DROP TABLE `users`;
--> statement-breakpoint
ALTER TABLE `__new_users` RENAME TO `users`;
--> statement-breakpoint
PRAGMA foreign_keys=ON;
--> statement-breakpoint
CREATE UNIQUE INDEX `users_username_unique` ON `users` (`username`);
--> statement-breakpoint
CREATE UNIQUE INDEX `users_api_key_unique` ON `users` (`api_key`);
--> statement-breakpoint
CREATE UNIQUE INDEX `users_calendar_feed_token_unique` ON `users` (`calendar_feed_token`);
