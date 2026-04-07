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
    case "signal.signal_cli":
      return "recipient";
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
    case "signal.signal_cli":
      return "recipient";
  }
}

export function getReminderEndpointAdapterHint(
  adapter: Pick<
    ReminderAdapterManifest,
    "key" | "configScope" | "capabilities"
  >,
): string | null {
  if (adapter.key === "signal.signal_cli") {
    return "beta · requires signal-cli runtime on the server";
  }

  if (adapter.configScope === "system") {
    return "requires transport config";
  }

  return null;
}
