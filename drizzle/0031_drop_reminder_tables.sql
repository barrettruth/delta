-- Reminder code has been retired. This migration intentionally discards
-- existing reminder endpoint, schedule, and delivery data.
DROP TABLE `reminder_deliveries`;
--> statement-breakpoint
DROP TABLE `task_reminders`;
--> statement-breakpoint
DROP TABLE `reminder_endpoints`;
