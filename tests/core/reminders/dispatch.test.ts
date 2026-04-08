import { beforeEach, describe, expect, it, vi } from "vitest";
import { enqueueReminderDelivery } from "@/core/reminders/deliveries";
import {
  dispatchReminderDelivery,
  sendReminderEndpointTest,
} from "@/core/reminders/dispatch";
import {
  createReminderEndpoint,
  getReminderEndpoint,
} from "@/core/reminders/endpoints";
import { createTaskReminder } from "@/core/reminders/rules";
import { setSystemConfig } from "@/core/system-config";
import { createTask } from "@/core/task";
import type { Db } from "@/core/types";
import { createTestDb, createTestUser } from "../../helpers";

const TEST_KEY =
  "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";

let db: Db;
let userId: number;

function createDeliveryFixture(
  adapterKey:
    | "sms.twilio"
    | "telegram.bot_api"
    | "slack.webhook"
    | "discord.webhook",
  target: string,
) {
  const task = createTask(db, userId, {
    description: `Task for ${adapterKey}`,
    due: "2026-04-06T15:30:00.000Z",
  });
  const endpoint = createReminderEndpoint(db, userId, {
    adapterKey,
    label: adapterKey,
    target,
  });
  const reminder = createTaskReminder(db, userId, {
    taskId: task.id,
    endpointId: endpoint.id,
    anchor: "due",
    offsetMinutes: -10,
  });
  const delivery = enqueueReminderDelivery(db, {
    userId,
    taskId: task.id,
    taskReminderId: reminder.id,
    endpointId: endpoint.id,
    adapterKey,
    scheduledFor: "2026-04-06T15:20:00.000Z",
  });

  return { task, endpoint, reminder, delivery };
}

beforeEach(() => {
  vi.stubEnv("INTEGRATION_ENCRYPTION_KEY", TEST_KEY);
  vi.unstubAllGlobals();
  db = createTestDb();
  userId = createTestUser(db).id;
});

describe("dispatchReminderDelivery", () => {
  it("dispatches Slack webhook deliveries and marks them sent", async () => {
    const { delivery, task } = createDeliveryFixture(
      "slack.webhook",
      "https://slack.test/hook",
    );
    const fetchMock = vi.fn(async () => new Response("ok", { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    const sent = await dispatchReminderDelivery(db, delivery.id, {
      nowIso: "2026-04-06T15:20:00.000Z",
    });

    expect(sent?.status).toBe("sent");
    expect(sent?.renderedBody).toContain(task.description);
    expect(fetchMock).toHaveBeenCalledOnce();
    expect(fetchMock).toHaveBeenCalledWith(
      "https://slack.test/hook",
      expect.objectContaining({
        method: "POST",
        headers: { "Content-Type": "application/json" },
      }),
    );
    const request = (
      fetchMock.mock.calls[0] as unknown as [string, { body: string }]
    )[1] as {
      body: string;
    };
    expect(JSON.parse(request.body)).toMatchObject({
      text: expect.stringContaining(task.description),
    });
  });

  it("dispatches Twilio SMS deliveries with system config", async () => {
    setSystemConfig(db, "reminders.sms.twilio.account_sid", "AC123");
    setSystemConfig(db, "reminders.sms.twilio.auth_token", "token-123");
    setSystemConfig(db, "reminders.sms.twilio.from_number", "+15125559999");

    const { delivery } = createDeliveryFixture("sms.twilio", "+15125550109");
    const fetchMock = vi.fn(
      async () =>
        new Response(JSON.stringify({ sid: "SM123" }), {
          status: 201,
          headers: { "content-type": "application/json" },
        }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const sent = await dispatchReminderDelivery(db, delivery.id, {
      nowIso: "2026-04-06T15:20:00.000Z",
    });

    expect(sent?.status).toBe("sent");
    expect(sent?.providerMessageId).toBe("SM123");
    expect(fetchMock).toHaveBeenCalledOnce();
    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.twilio.com/2010-04-01/Accounts/AC123/Messages.json",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          Authorization: `Basic ${Buffer.from("AC123:token-123").toString("base64")}`,
          "Content-Type": "application/x-www-form-urlencoded",
        }),
      }),
    );
    const request = (
      fetchMock.mock.calls[0] as unknown as [string, { body: URLSearchParams }]
    )[1] as {
      body: URLSearchParams;
    };
    expect(request.body.get("To")).toBe("+15125550109");
    expect(request.body.get("From")).toBe("+15125559999");
    expect(request.body.get("Body")).toContain("Task for sms.twilio");
  });

  it("marks permanent adapter failures as dead", async () => {
    const { delivery } = createDeliveryFixture(
      "discord.webhook",
      "https://discord.test/hook",
    );
    const fetchMock = vi.fn(
      async () => new Response("bad request", { status: 400 }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const failed = await dispatchReminderDelivery(db, delivery.id, {
      nowIso: "2026-04-06T15:20:00.000Z",
    });

    expect(failed?.status).toBe("dead");
    expect(failed?.error).toContain("unexpected error (400)");
  });

  it("marks transient adapter failures for retry", async () => {
    const { delivery } = createDeliveryFixture(
      "discord.webhook",
      "https://discord.test/hook",
    );
    const fetchMock = vi.fn(async () => new Response("down", { status: 503 }));
    vi.stubGlobal("fetch", fetchMock);

    const failed = await dispatchReminderDelivery(db, delivery.id, {
      nowIso: "2026-04-06T15:20:00.000Z",
    });

    expect(failed?.status).toBe("failed");
    expect(failed?.nextAttemptAt).toBeTruthy();
  });
});

describe("sendReminderEndpointTest", () => {
  it("sends a Slack endpoint test and records success", async () => {
    const endpoint = createReminderEndpoint(db, userId, {
      adapterKey: "slack.webhook",
      label: "Slack",
      target: "https://slack.test/test-hook",
    });
    const fetchMock = vi.fn(async () => new Response("ok", { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    const result = await sendReminderEndpointTest(db, userId, endpoint.id, {
      body: "Reminder test body",
    });

    expect(result.endpoint.lastTestStatus).toBe("ok");
    expect(result.providerMessageId).toBeNull();
    expect(fetchMock).toHaveBeenCalledOnce();
  });

  it("records failed endpoint tests", async () => {
    const endpoint = createReminderEndpoint(db, userId, {
      adapterKey: "slack.webhook",
      label: "Slack",
      target: "https://slack.test/test-hook",
    });
    const fetchMock = vi.fn(
      async () => new Response("bad request", { status: 400 }),
    );
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      sendReminderEndpointTest(db, userId, endpoint.id, {
        body: "Reminder test body",
      }),
    ).rejects.toThrow("unexpected error (400)");

    expect(getReminderEndpoint(db, userId, endpoint.id)?.lastTestStatus).toBe(
      "failed",
    );
  });

  it("throws for nonexistent endpoints", async () => {
    await expect(sendReminderEndpointTest(db, userId, 999)).rejects.toThrow(
      "Reminder endpoint 999 not found",
    );
  });
});
