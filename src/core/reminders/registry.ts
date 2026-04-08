import type { ReminderAdapterManifest } from "./types";

const MANIFESTS = [
  {
    key: "sms.twilio",
    channel: "sms",
    displayName: "Twilio SMS",
    configScope: "system",
    capabilities: {
      supportsDeliveryStatus: true,
      supportsRichText: false,
      supportsTestSend: true,
      beta: false,
    },
  },
  {
    key: "whatsapp.twilio",
    channel: "whatsapp",
    displayName: "Twilio WhatsApp",
    configScope: "system",
    capabilities: {
      supportsDeliveryStatus: true,
      supportsRichText: false,
      supportsTestSend: true,
      beta: false,
    },
  },
  {
    key: "telegram.bot_api",
    channel: "telegram",
    displayName: "Telegram Bot API",
    configScope: "system",
    capabilities: {
      supportsDeliveryStatus: false,
      supportsRichText: false,
      supportsTestSend: true,
      beta: false,
    },
  },
  {
    key: "discord.webhook",
    channel: "discord",
    displayName: "Discord Webhook",
    configScope: "none",
    capabilities: {
      supportsDeliveryStatus: false,
      supportsRichText: false,
      supportsTestSend: true,
      beta: false,
    },
  },
  {
    key: "slack.webhook",
    channel: "slack",
    displayName: "Slack Webhook",
    configScope: "none",
    capabilities: {
      supportsDeliveryStatus: false,
      supportsRichText: false,
      supportsTestSend: true,
      beta: false,
    },
  },
] satisfies ReminderAdapterManifest[];

const MANIFEST_BY_KEY = new Map<string, ReminderAdapterManifest>(
  MANIFESTS.map((manifest) => [manifest.key, manifest]),
);

function cloneManifest(
  manifest: ReminderAdapterManifest,
): ReminderAdapterManifest {
  return {
    ...manifest,
    capabilities: { ...manifest.capabilities },
  };
}

export function listReminderAdapters(): ReminderAdapterManifest[] {
  return MANIFESTS.map(cloneManifest);
}

export function getReminderAdapter(
  key: string,
): ReminderAdapterManifest | null {
  const manifest = MANIFEST_BY_KEY.get(key);
  return manifest ? cloneManifest(manifest) : null;
}
