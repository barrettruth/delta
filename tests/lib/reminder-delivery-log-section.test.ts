import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ReminderDeliveryLogSection } from "@/components/settings/reminder-delivery-log-section";
import type { ReminderDeliveryLogRecord } from "@/core/reminders/deliveries";
import { listReminderAdapters } from "@/core/reminders/registry";

function createDelivery(input: {
  id: number;
  adapterKey:
    | "sms.twilio"
    | "whatsapp.twilio"
    | "telegram.bot_api"
    | "slack.webhook"
    | "discord.webhook";
  status: "pending" | "sending" | "sent" | "failed" | "dead" | "suppressed";
  taskDescription: string;
  endpointLabel: string;
  attempts?: number;
  nextAttemptAt?: string | null;
  providerMessageId?: string | null;
  renderedBody?: string | null;
  error?: string | null;
  lastAttemptAt?: string | null;
  sentAt?: string | null;
}): ReminderDeliveryLogRecord {
  return {
    id: input.id,
    userId: 1,
    taskId: input.id,
    taskReminderId: input.id,
    endpointId: input.id,
    adapterKey: input.adapterKey,
    dedupeKey: `1:${input.id}`,
    scheduledFor: "2026-04-06T15:15:00.000Z",
    status: input.status,
    attempts: input.attempts ?? 0,
    nextAttemptAt: input.nextAttemptAt ?? null,
    providerMessageId: input.providerMessageId ?? null,
    renderedBody: input.renderedBody ?? null,
    error: input.error ?? null,
    lastAttemptAt: input.lastAttemptAt ?? null,
    sentAt: input.sentAt ?? null,
    createdAt: "2026-04-06T15:14:00.000Z",
    updatedAt: "2026-04-06T15:14:00.000Z",
    task: {
      id: input.id,
      description: input.taskDescription,
      status: "pending",
      due: "2026-04-06T15:30:00.000Z",
      startAt: null,
      allDay: 0,
      timezone: null,
    },
    endpoint: {
      id: input.id,
      label: input.endpointLabel,
      enabled: 1,
    },
    reminder: {
      id: input.id,
      anchor: "due",
      offsetMinutes: -15,
      allDayLocalTime: null,
      enabled: 1,
    },
  };
}

describe("ReminderDeliveryLogSection", () => {
  it("renders issues and recent sends", () => {
    const html = renderToStaticMarkup(
      createElement(ReminderDeliveryLogSection, {
        deliveries: [
          createDelivery({
            id: 1,
            adapterKey: "telegram.bot_api",
            status: "failed",
            taskDescription: "Check telegram bot",
            endpointLabel: "Telegram",
            attempts: 1,
            nextAttemptAt: "2026-04-06T15:18:00.000Z",
            error: "temporary",
            lastAttemptAt: "2026-04-06T15:17:00.000Z",
          }),
          createDelivery({
            id: 2,
            adapterKey: "slack.webhook",
            status: "dead",
            taskDescription: "Slack alert",
            endpointLabel: "Slack",
            attempts: 3,
            error: "fatal",
            lastAttemptAt: "2026-04-06T15:19:00.000Z",
          }),
          createDelivery({
            id: 3,
            adapterKey: "sms.twilio",
            status: "sent",
            taskDescription: "Pay rent",
            endpointLabel: "Phone",
            attempts: 1,
            providerMessageId: "msg_123",
            renderedBody: "Pay rent in 15 minutes",
            lastAttemptAt: "2026-04-06T15:16:00.000Z",
            sentAt: "2026-04-06T15:16:00.000Z",
          }),
        ],
        adapters: listReminderAdapters(),
      }),
    );

    expect(html).toContain("issues");
    expect(html).toContain("Check telegram bot");
    expect(html).toContain("Slack alert");
    expect(html).toContain("Pay rent");
    expect(html).toContain("next attempt 2026-04-06 15:18 UTC");
    expect(html).toContain("no more retries");
    expect(html).toContain("recent sends");
    expect(html).toContain("Twilio SMS");
    expect(html).toContain("Telegram Bot API");
    expect(html).toContain("Slack Webhook");
    expect(html).not.toContain("operator playbooks");
  });

  it("renders empty states when no deliveries exist yet", () => {
    const html = renderToStaticMarkup(
      createElement(ReminderDeliveryLogSection, {
        deliveries: [],
        adapters: listReminderAdapters(),
      }),
    );

    expect(html).toContain("no failed reminder sends");
    expect(html).toContain("no reminder sends yet");
  });
});
