import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  claimReminderDelivery,
  enqueueReminderDelivery,
  getReminderDelivery,
  markReminderDeliveryFailed,
} from "@/core/reminders/deliveries";
import { createReminderEndpoint } from "@/core/reminders/endpoints";
import { createTaskReminder } from "@/core/reminders/rules";
import { runReminderWorker } from "@/core/reminders/worker";
import { completeTask, createTask, deleteTask } from "@/core/task";
import type { Db } from "@/core/types";
import { createTestDb, createTestUser } from "../../helpers";

const TEST_KEY =
  "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";

let db: Db;
let userId: number;

beforeEach(() => {
  vi.stubEnv("INTEGRATION_ENCRYPTION_KEY", TEST_KEY);
  db = createTestDb();
  userId = createTestUser(db).id;
});

describe("runReminderWorker", () => {
  it("enqueues due reminder deliveries", async () => {
    const task = createTask(db, userId, {
      description: "Due soon",
      due: "2026-04-06T15:30:00.000Z",
    });
    const endpoint = createReminderEndpoint(db, userId, {
      adapterKey: "sms.twilio",
      label: "Phone",
      target: "+15125550107",
    });

    createTaskReminder(db, userId, {
      taskId: task.id,
      endpointId: endpoint.id,
      anchor: "due",
      offsetMinutes: -10,
    });

    const result = await runReminderWorker(db, {
      nowIso: "2026-04-06T15:20:00.000Z",
      userTimezoneResolver: () => "UTC",
    });

    expect(result.enqueued).toHaveLength(1);
    expect(result.enqueued[0]).toMatchObject({
      taskId: task.id,
      endpointId: endpoint.id,
      status: "pending",
      scheduledFor: "2026-04-06T15:20:00.000Z",
    });
  });

  it("does not enqueue future reminder deliveries", async () => {
    const task = createTask(db, userId, {
      description: "Not due yet",
      due: "2026-04-06T15:30:00.000Z",
    });
    const endpoint = createReminderEndpoint(db, userId, {
      adapterKey: "telegram.bot_api",
      label: "Telegram",
      target: "777",
    });

    createTaskReminder(db, userId, {
      taskId: task.id,
      endpointId: endpoint.id,
      anchor: "due",
      offsetMinutes: -10,
    });

    const result = await runReminderWorker(db, {
      nowIso: "2026-04-06T15:19:00.000Z",
      userTimezoneResolver: () => "UTC",
    });

    expect(result.enqueued).toHaveLength(0);
  });

  it("dispatches due webhook deliveries in the same worker run", async () => {
    const task = createTask(db, userId, {
      description: "Webhook due now",
      due: "2026-04-06T15:30:00.000Z",
    });
    const endpoint = createReminderEndpoint(db, userId, {
      adapterKey: "slack.webhook",
      label: "Slack",
      target: "https://slack.test/worker",
    });

    createTaskReminder(db, userId, {
      taskId: task.id,
      endpointId: endpoint.id,
      anchor: "due",
      offsetMinutes: -10,
    });

    const fetchMock = vi.fn(async () => new Response("ok", { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    const result = await runReminderWorker(db, {
      nowIso: "2026-04-06T15:20:00.000Z",
      userTimezoneResolver: () => "UTC",
    });

    expect(result.enqueued).toHaveLength(1);
    expect(getReminderDelivery(db, result.enqueued[0].id)?.status).toBe("sent");
  });
});

describe("task lifecycle reminder suppression", () => {
  it("suppresses pending deliveries when a task is completed", () => {
    const task = createTask(db, userId, {
      description: "Complete me",
      due: "2026-04-06T15:30:00.000Z",
    });
    const endpoint = createReminderEndpoint(db, userId, {
      adapterKey: "sms.twilio",
      label: "Phone",
      target: "+15125550108",
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
      adapterKey: endpoint.adapterKey,
      scheduledFor: "2026-04-06T15:20:00.000Z",
    });

    completeTask(db, userId, task.id);

    expect(getReminderDelivery(db, delivery.id)?.status).toBe("suppressed");
  });

  it("suppresses failed deliveries when a task is cancelled", () => {
    const task = createTask(db, userId, {
      description: "Cancel me",
      due: "2026-04-06T15:30:00.000Z",
    });
    const endpoint = createReminderEndpoint(db, userId, {
      adapterKey: "discord.webhook",
      label: "Discord",
      target: "https://discord.test/worker",
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
      adapterKey: endpoint.adapterKey,
      scheduledFor: "2026-04-06T15:20:00.000Z",
    });

    claimReminderDelivery(db, delivery.id, "2026-04-06T15:20:00.000Z");
    markReminderDeliveryFailed(db, delivery.id, "temporary outage");

    deleteTask(db, task.id);

    expect(getReminderDelivery(db, delivery.id)?.status).toBe("suppressed");
  });
});
