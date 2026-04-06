import type {
  reminderDeliveries,
  reminderEndpoints,
  taskReminders,
} from "@/db/schema";

export const REMINDER_CHANNELS = [
  "sms",
  "signal",
  "telegram",
  "discord",
  "slack",
] as const;
export type ReminderChannel = (typeof REMINDER_CHANNELS)[number];

export const REMINDER_ADAPTER_KEYS = [
  "sms.twilio",
  "signal.signal_cli",
  "telegram.bot_api",
  "discord.webhook",
  "slack.webhook",
] as const;
export type ReminderAdapterKey = (typeof REMINDER_ADAPTER_KEYS)[number];

export const REMINDER_CONFIG_SCOPES = ["system", "user", "none"] as const;
export type ReminderConfigScope = (typeof REMINDER_CONFIG_SCOPES)[number];

export const REMINDER_ANCHORS = ["due", "start"] as const;
export type ReminderAnchor = (typeof REMINDER_ANCHORS)[number];

export const REMINDER_TEST_STATUSES = ["ok", "failed"] as const;
export type ReminderTestStatus = (typeof REMINDER_TEST_STATUSES)[number];

export const REMINDER_DELIVERY_STATUSES = [
  "pending",
  "sending",
  "sent",
  "failed",
  "dead",
  "suppressed",
] as const;
export type ReminderDeliveryStatus =
  (typeof REMINDER_DELIVERY_STATUSES)[number];

export interface ReminderAdapterCapabilities {
  supportsDeliveryStatus: boolean;
  supportsRichText: boolean;
  supportsTestSend: boolean;
  beta: boolean;
}

export interface ReminderAdapterManifest {
  key: ReminderAdapterKey;
  channel: ReminderChannel;
  displayName: string;
  configScope: ReminderConfigScope;
  capabilities: ReminderAdapterCapabilities;
}

export type ReminderEndpoint = typeof reminderEndpoints.$inferSelect;
export type TaskReminder = typeof taskReminders.$inferSelect;
export type ReminderDelivery = typeof reminderDeliveries.$inferSelect;

export function isReminderAdapterKey(
  value: string,
): value is ReminderAdapterKey {
  return REMINDER_ADAPTER_KEYS.includes(value as ReminderAdapterKey);
}

export function isReminderChannel(value: string): value is ReminderChannel {
  return REMINDER_CHANNELS.includes(value as ReminderChannel);
}

export function isReminderAnchor(value: string): value is ReminderAnchor {
  return REMINDER_ANCHORS.includes(value as ReminderAnchor);
}

export function isReminderDeliveryStatus(
  value: string,
): value is ReminderDeliveryStatus {
  return REMINDER_DELIVERY_STATUSES.includes(value as ReminderDeliveryStatus);
}
