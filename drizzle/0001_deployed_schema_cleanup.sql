DROP TABLE IF EXISTS `accounts`;
--> statement-breakpoint
DROP TABLE IF EXISTS `automations`;
--> statement-breakpoint
DROP TABLE IF EXISTS `event_share_links`;
--> statement-breakpoint
DROP TABLE IF EXISTS `invite_links`;
--> statement-breakpoint
DROP TABLE IF EXISTS `recovery_codes`;
--> statement-breakpoint
DROP TABLE IF EXISTS `sessions`;
--> statement-breakpoint
DROP TABLE IF EXISTS `webauthn_credentials`;
--> statement-breakpoint
CREATE TEMP TABLE `__delta_backup_users` AS SELECT * FROM `users`;
--> statement-breakpoint
CREATE TEMP TABLE `__delta_backup_tasks` AS SELECT * FROM `tasks`;
--> statement-breakpoint
CREATE TEMP TABLE `__delta_backup_task_dependencies` AS SELECT * FROM `task_dependencies`;
--> statement-breakpoint
CREATE TEMP TABLE `__delta_backup_category_colors` AS SELECT * FROM `category_colors`;
--> statement-breakpoint
CREATE TEMP TABLE `__delta_backup_user_settings` AS SELECT * FROM `user_settings`;
--> statement-breakpoint
CREATE TEMP TABLE `__delta_backup_integration_configs` AS SELECT * FROM `integration_configs`;
--> statement-breakpoint
CREATE TEMP TABLE `__delta_backup_task_external_links` AS SELECT * FROM `task_external_links`;
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
SELECT "id", "username", COALESCE("api_key", lower(hex(randomblob(32)))), "calendar_feed_token", "created_at" FROM `__delta_backup_users`;
--> statement-breakpoint
DROP TABLE `users`;
--> statement-breakpoint
ALTER TABLE `__new_users` RENAME TO `users`;
--> statement-breakpoint
CREATE UNIQUE INDEX `users_username_unique` ON `users` (`username`);
--> statement-breakpoint
CREATE UNIQUE INDEX `users_api_key_unique` ON `users` (`api_key`);
--> statement-breakpoint
CREATE UNIQUE INDEX `users_calendar_feed_token_unique` ON `users` (`calendar_feed_token`);
--> statement-breakpoint
DELETE FROM `task_external_links`;
--> statement-breakpoint
DELETE FROM `task_dependencies`;
--> statement-breakpoint
DELETE FROM `tasks`;
--> statement-breakpoint
DELETE FROM `category_colors`;
--> statement-breakpoint
DELETE FROM `user_settings`;
--> statement-breakpoint
DELETE FROM `integration_configs`;
--> statement-breakpoint
INSERT INTO `tasks`("id", "user_id", "description", "status", "category", "due", "recurrence", "recur_mode", "notes", "order", "created_at", "updated_at", "start_at", "end_at", "all_day", "timezone", "completed_at", "location", "location_lat", "location_lon", "meeting_url", "exdates", "rdates", "recurring_task_id", "original_start_at")
SELECT "id", "user_id", "description", "status", "category", "due", "recurrence", "recur_mode", "notes", "order", "created_at", "updated_at", "start_at", "end_at", "all_day", "timezone", "completed_at", "location", "location_lat", "location_lon", "meeting_url", "exdates", "rdates", "recurring_task_id", "original_start_at" FROM `__delta_backup_tasks`;
--> statement-breakpoint
INSERT INTO `task_dependencies`("task_id", "depends_on_id")
SELECT "task_id", "depends_on_id" FROM `__delta_backup_task_dependencies`;
--> statement-breakpoint
INSERT INTO `category_colors`("user_id", "category", "color")
SELECT "user_id", "category", "color" FROM `__delta_backup_category_colors`;
--> statement-breakpoint
INSERT INTO `user_settings`("user_id", "settings")
SELECT "user_id", "settings" FROM `__delta_backup_user_settings`;
--> statement-breakpoint
INSERT INTO `integration_configs`("id", "user_id", "provider", "encrypted_tokens", "metadata", "enabled", "created_at", "updated_at")
SELECT "id", "user_id", "provider", "encrypted_tokens", "metadata", "enabled", "created_at", "updated_at" FROM `__delta_backup_integration_configs`;
--> statement-breakpoint
INSERT INTO `task_external_links`("id", "user_id", "task_id", "provider", "external_id", "metadata", "last_synced_at", "created_at", "updated_at")
SELECT "id", "user_id", "task_id", "provider", "external_id", "metadata", "last_synced_at", "created_at", "updated_at" FROM `__delta_backup_task_external_links`;
--> statement-breakpoint
DROP TABLE `__delta_backup_task_external_links`;
--> statement-breakpoint
DROP TABLE `__delta_backup_integration_configs`;
--> statement-breakpoint
DROP TABLE `__delta_backup_user_settings`;
--> statement-breakpoint
DROP TABLE `__delta_backup_category_colors`;
--> statement-breakpoint
DROP TABLE `__delta_backup_task_dependencies`;
--> statement-breakpoint
DROP TABLE `__delta_backup_tasks`;
--> statement-breakpoint
DROP TABLE `__delta_backup_users`;
