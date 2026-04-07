import type { ReminderAdapterKey } from "@/core/reminders/types";

export const REMINDER_TRANSPORT_CONFIGURABLE_ADAPTER_KEYS = [
  "sms.twilio",
  "signal.signal_cli",
  "telegram.bot_api",
] as const;

export type ReminderTransportConfigurableAdapterKey =
  (typeof REMINDER_TRANSPORT_CONFIGURABLE_ADAPTER_KEYS)[number];

export interface ReminderTransportField {
  name: string;
  label: string;
  placeholder: string;
  inputType: "password" | "tel" | "text";
  systemConfigKey: string;
}

export interface ReminderTransportConfigStatus {
  adapterKey: ReminderTransportConfigurableAdapterKey;
  configured: boolean;
  missingFields: string[];
}

const REMINDER_TRANSPORT_FIELDS = {
  "sms.twilio": [
    {
      name: "accountSid",
      label: "account SID",
      placeholder: "AC123456789",
      inputType: "text",
      systemConfigKey: "reminders.sms.twilio.account_sid",
    },
    {
      name: "authToken",
      label: "auth token",
      placeholder: "auth token",
      inputType: "password",
      systemConfigKey: "reminders.sms.twilio.auth_token",
    },
    {
      name: "fromNumber",
      label: "from number",
      placeholder: "+15125550123",
      inputType: "tel",
      systemConfigKey: "reminders.sms.twilio.from_number",
    },
  ],
  "telegram.bot_api": [
    {
      name: "botToken",
      label: "bot token",
      placeholder: "123456:ABCDEF",
      inputType: "password",
      systemConfigKey: "reminders.telegram.bot_api.bot_token",
    },
  ],
  "signal.signal_cli": [
    {
      name: "account",
      label: "account",
      placeholder: "+15125550123",
      inputType: "tel",
      systemConfigKey: "reminders.signal.signal_cli.account",
    },
    {
      name: "configPath",
      label: "config path",
      placeholder: "/var/lib/signal-cli",
      inputType: "text",
      systemConfigKey: "reminders.signal.signal_cli.config_path",
    },
  ],
} satisfies Record<
  ReminderTransportConfigurableAdapterKey,
  ReminderTransportField[]
>;

export function isReminderTransportConfigurableAdapterKey(
  value: string,
): value is ReminderTransportConfigurableAdapterKey {
  return REMINDER_TRANSPORT_CONFIGURABLE_ADAPTER_KEYS.includes(
    value as ReminderTransportConfigurableAdapterKey,
  );
}

export function getReminderTransportFields(
  adapterKey: ReminderTransportConfigurableAdapterKey,
): ReminderTransportField[] {
  return REMINDER_TRANSPORT_FIELDS[adapterKey].map((field) => ({ ...field }));
}

export function getEmptyReminderTransportConfigStatus(
  adapterKey: ReminderTransportConfigurableAdapterKey,
): ReminderTransportConfigStatus {
  return {
    adapterKey,
    configured: false,
    missingFields: getReminderTransportFields(adapterKey).map(
      (field) => field.name,
    ),
  };
}

export function getReminderTransportStatusLabel(
  status: ReminderTransportConfigStatus,
): string {
  if (status.configured) {
    return "configured";
  }

  return status.missingFields.length ===
    getReminderTransportFields(status.adapterKey).length
    ? "needs setup"
    : "incomplete";
}

export function normalizeReminderTransportConfigValues(
  adapterKey: ReminderTransportConfigurableAdapterKey,
  input: unknown,
): { ok: true; values: Record<string, string> } | { ok: false; error: string } {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    return { ok: false, error: "values are required" };
  }

  const values: Record<string, string> = {};
  for (const field of getReminderTransportFields(adapterKey)) {
    const value = (input as Record<string, unknown>)[field.name];
    if (typeof value !== "string" || !value.trim()) {
      return { ok: false, error: `${field.label} is required` };
    }
    values[field.name] = value.trim();
  }

  return { ok: true, values };
}

export function isReminderTransportConfigurableAdapter(
  adapterKey: ReminderAdapterKey,
): adapterKey is ReminderTransportConfigurableAdapterKey {
  return isReminderTransportConfigurableAdapterKey(adapterKey);
}
