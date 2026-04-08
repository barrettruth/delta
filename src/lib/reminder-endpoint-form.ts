import type { ReminderAdapterManifest } from "@/core/reminders/types";

export function getReminderEndpointTargetLabel(
  adapterKey: ReminderAdapterManifest["key"],
): string {
  switch (adapterKey) {
    case "sms.twilio":
      return "phone number";
    case "telegram.bot_api":
      return "chat id";
    case "slack.webhook":
    case "discord.webhook":
      return "webhook URL";
  }
}

export function getReminderEndpointTargetPlaceholder(
  adapterKey: ReminderAdapterManifest["key"],
): string {
  switch (adapterKey) {
    case "sms.twilio":
      return "+15125550123";
    case "telegram.bot_api":
      return "123456789";
    case "slack.webhook":
    case "discord.webhook":
      return "https://";
  }
}

export function getReminderEndpointAdapterHint(
  adapter: Pick<
    ReminderAdapterManifest,
    "key" | "configScope" | "capabilities"
  >,
): string | null {
  if (adapter.configScope === "system") {
    return "requires transport config";
  }

  return null;
}
