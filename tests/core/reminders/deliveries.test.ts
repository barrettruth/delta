import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  buildReminderDedupeKey,
  claimReminderDelivery,
  computeReminderRetryDelayMinutes,
  enqueueDueReminderDeliveries,
  enqueueReminderDelivery,
  getReminderDelivery,
  getReminderDeliveryLogEntry,
  listDispatchableReminderDeliveries,
  listReminderDeliveryLog,
  MAX_REMINDER_ATTEMPTS,
  markReminderDeliveryFailed,
  markReminderDeliverySent,
  suppressPendingReminderDeliveriesForTask,
} from "@/core/reminders/deliveries";
import { createReminderEndpoint } from "@/core/reminders/endpoints";
import { createTaskReminder } from "@/core/reminders/rules";
import { createTask, updateTask } from "@/core/task";
import type { Db } from "@/core/types";
import { createTestDb, createTestUser } from "../../helpers";

const TEST_KEY =
  "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";

let db: Db;
let userId: number;

function createDeliveryFixture(
  adapterKey:
    | "sms.twilio"
    | "whatsapp.twilio"
    | "telegram.bot_api"
    | "slack.webhook"
    | "discord.webhook" = "sms.twilio",
) {
  const task = createTask(db, userId, {
    description: `Task for ${adapterKey}`,
    due: "2026-04-06T15:30:00.000Z",
  });
  const endpoint = createReminderEndpoint(db, userId, {
    adapterKey,
    label: adapterKey,
    target:
      adapterKey === "sms.twilio" || adapterKey === "whatsapp.twilio"
        ? "+15125501381"
        : adapterKey === "telegram.bot_api"
          ? "1234"
          : `https://${adapterKey.replace(".", "-")}.test/hook`,
  });
  const reminder = createTaskReminder(db, userId, {
    taskId: task.id,
    endpointId: endpoint.id,
    anchor: "due",
    offsetMinutes: -10,
  });

  return { task, endpoint, reminder };
}

beforeEach(() => {
  vi.stubEnv("INTEGRATION_ENCRYPTION_KEY", TEST_KEY);
  db = createTestDb();
  userId = createTestUser(db).id;
});

describe("reminder delivery queue", () => {
  it("builds stable dedupe keys", () => {
    const key = buildReminderDedupeKey({
      userId,
      taskId: 1,
      taskReminderId: 2,
      endpointId: 3,
      scheduledFor: "2026-04-06T15:20:00.000Z",
    });

    expect(key).toBe(`${userId}:1:2:3:2026-04-06T15:20:00.000Z`);
  });

  it("enqueues deliveries idempotently", () => {
    const { task, endpoint, reminder } = createDeliveryFixture();

    const first = enqueueReminderDelivery(db, {
      userId,
      taskId: task.id,
      taskReminderId: reminder.id,
      endpointId: endpoint.id,
      adapterKey: "sms.twilio",
      scheduledFor: "2026-04-06T15:20:00.000Z",
    });
    const second = enqueueReminderDelivery(db, {
      userId,
      taskId: task.id,
      taskReminderId: reminder.id,
      endpointId: endpoint.id,
      adapterKey: "sms.twilio",
      scheduledFor: "2026-04-06T15:20:00.000Z",
    });

    expect(first.id).toBe(second.id);
    expect(
      listDispatchableReminderDeliveries(db, "2026-04-06T16:00:00.000Z"),
    ).toHaveLength(1);
  });

  it("enqueues due reminder rules from tasks", () => {
    const task = createTask(db, userId, {
      description: "Pay rent",
      due: "2026-04-06T15:30:00.000Z",
    });
    const endpoint = createReminderEndpoint(db, userId, {
      adapterKey: "sms.twilio",
      label: "sms",
      target: "+15125501381",
    });

    createTaskReminder(db, userId, {
      taskId: task.id,
      endpointId: endpoint.id,
      anchor: "due",
      offsetMinutes: -10,
    });

    const deliveries = enqueueDueReminderDeliveries(db, {
      nowIso: "2026-04-06T15:25:00.000Z",
      userTimezoneResolver: () => "UTC",
    });

    expect(deliveries).toHaveLength(1);
    expect(deliveries[0].scheduledFor).toBe("2026-04-06T15:20:00.000Z");
  });

  it("does not enqueue future reminders", () => {
    const task = createTask(db, userId, {
      description: "Standup",
      due: "2026-04-06T15:30:00.000Z",
    });
    const endpoint = createReminderEndpoint(db, userId, {
      adapterKey: "telegram.bot_api",
      label: "telegram",
      target: "1234",
    });

    createTaskReminder(db, userId, {
      taskId: task.id,
      endpointId: endpoint.id,
      anchor: "due",
      offsetMinutes: -10,
    });

    const deliveries = enqueueDueReminderDeliveries(db, {
      nowIso: "2026-04-06T15:10:00.000Z",
      userTimezoneResolver: () => "UTC",
    });

    expect(deliveries).toHaveLength(0);
  });

  it("suppresses pending deliveries for completed tasks", () => {
    const task = createTask(db, userId, {
      description: "Doctor call",
      due: "2026-04-06T15:30:00.000Z",
    });
    const endpoint = createReminderEndpoint(db, userId, {
      adapterKey: "sms.twilio",
      label: "sms",
      target: "+15125501381",
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

    updateTask(db, task.id, { status: "done" });

    enqueueDueReminderDeliveries(db, {
      nowIso: "2026-04-06T15:25:00.000Z",
      userTimezoneResolver: () => "UTC",
    });

    const updated = getReminderDelivery(db, delivery.id);
    expect(updated?.status).toBe("suppressed");
  });
});

describe("reminder delivery dispatch state", () => {
  it("lists dispatchable pending and retryable failed deliveries", () => {
    const pendingFixture = createDeliveryFixture("sms.twilio");
    const pending = enqueueReminderDelivery(db, {
      userId,
      taskId: pendingFixture.task.id,
      taskReminderId: pendingFixture.reminder.id,
      endpointId: pendingFixture.endpoint.id,
      adapterKey: "sms.twilio",
      scheduledFor: "2026-04-06T15:20:00.000Z",
    });

    const failedFixture = createDeliveryFixture("telegram.bot_api");
    const failed = enqueueReminderDelivery(db, {
      userId,
      taskId: failedFixture.task.id,
      taskReminderId: failedFixture.reminder.id,
      endpointId: failedFixture.endpoint.id,
      adapterKey: "telegram.bot_api",
      scheduledFor: "2026-04-06T15:00:00.000Z",
    });

    claimReminderDelivery(db, failed.id, "2026-04-06T15:30:00.000Z");
    markReminderDeliveryFailed(db, failed.id, "temporary", true);

    const ready = listDispatchableReminderDeliveries(
      db,
      "2026-04-06T15:35:01.000Z",
    );

    expect(ready.map((item) => item.id)).toContain(pending.id);
    expect(ready.map((item) => item.id)).toContain(failed.id);
  });

  it("claims a delivery once and increments attempts", () => {
    const { task, endpoint, reminder } = createDeliveryFixture();
    const delivery = enqueueReminderDelivery(db, {
      userId,
      taskId: task.id,
      taskReminderId: reminder.id,
      endpointId: endpoint.id,
      adapterKey: "sms.twilio",
      scheduledFor: "2026-04-06T15:20:00.000Z",
    });

    const claimed = claimReminderDelivery(
      db,
      delivery.id,
      "2026-04-06T15:25:00.000Z",
    );
    const secondClaim = claimReminderDelivery(
      db,
      delivery.id,
      "2026-04-06T15:25:01.000Z",
    );

    expect(claimed?.status).toBe("sending");
    expect(claimed?.attempts).toBe(1);
    expect(secondClaim).toBeNull();
  });

  it("marks sending deliveries as sent", () => {
    const { task, endpoint, reminder } = createDeliveryFixture();
    const delivery = enqueueReminderDelivery(db, {
      userId,
      taskId: task.id,
      taskReminderId: reminder.id,
      endpointId: endpoint.id,
      adapterKey: "sms.twilio",
      scheduledFor: "2026-04-06T15:20:00.000Z",
    });

    claimReminderDelivery(db, delivery.id, "2026-04-06T15:25:00.000Z");
    const sent = markReminderDeliverySent(db, delivery.id, {
      providerMessageId: "msg_123",
      renderedBody: "reminder text",
    });

    expect(sent?.status).toBe("sent");
    expect(sent?.providerMessageId).toBe("msg_123");
    expect(sent?.renderedBody).toBe("reminder text");
    expect(sent?.sentAt).toBeTruthy();
  });

  it("marks retryable failures with a next attempt time", () => {
    const { task, endpoint, reminder } = createDeliveryFixture();
    const delivery = enqueueReminderDelivery(db, {
      userId,
      taskId: task.id,
      taskReminderId: reminder.id,
      endpointId: endpoint.id,
      adapterKey: "sms.twilio",
      scheduledFor: "2026-04-06T15:20:00.000Z",
    });

    claimReminderDelivery(db, delivery.id, "2026-04-06T15:25:00.000Z");
    const failed = markReminderDeliveryFailed(
      db,
      delivery.id,
      "temporary",
      true,
    );

    expect(failed?.status).toBe("failed");
    expect(failed?.nextAttemptAt).toBe("2026-04-06T15:26:00.000Z");
  });

  it("marks non-retryable failures as dead", () => {
    const { task, endpoint, reminder } = createDeliveryFixture();
    const delivery = enqueueReminderDelivery(db, {
      userId,
      taskId: task.id,
      taskReminderId: reminder.id,
      endpointId: endpoint.id,
      adapterKey: "sms.twilio",
      scheduledFor: "2026-04-06T15:20:00.000Z",
    });

    claimReminderDelivery(db, delivery.id, "2026-04-06T15:25:00.000Z");
    const failed = markReminderDeliveryFailed(db, delivery.id, "fatal", false);

    expect(failed?.status).toBe("dead");
    expect(failed?.nextAttemptAt).toBeNull();
  });

  it("marks exhausted retry attempts as dead", () => {
    const { task, endpoint, reminder } = createDeliveryFixture();
    const delivery = enqueueReminderDelivery(db, {
      userId,
      taskId: task.id,
      taskReminderId: reminder.id,
      endpointId: endpoint.id,
      adapterKey: "sms.twilio",
      scheduledFor: "2026-04-06T15:20:00.000Z",
    });

    const claimTimes = [
      "2026-04-06T15:25:00.000Z",
      "2026-04-06T15:26:00.000Z",
      "2026-04-06T15:31:00.000Z",
      "2026-04-06T15:46:00.000Z",
      "2026-04-06T16:46:00.000Z",
    ];

    for (let i = 0; i < MAX_REMINDER_ATTEMPTS; i++) {
      claimReminderDelivery(db, delivery.id, claimTimes[i]);
      const failed = markReminderDeliveryFailed(
        db,
        delivery.id,
        "temporary",
        true,
      );
      if (i < MAX_REMINDER_ATTEMPTS - 1) {
        expect(failed?.status).toBe("failed");
      } else {
        expect(failed?.status).toBe("dead");
      }
    }
  });

  it("suppresses pending and failed deliveries for a task", () => {
    const firstFixture = createDeliveryFixture("sms.twilio");
    const pending = enqueueReminderDelivery(db, {
      userId,
      taskId: firstFixture.task.id,
      taskReminderId: firstFixture.reminder.id,
      endpointId: firstFixture.endpoint.id,
      adapterKey: "sms.twilio",
      scheduledFor: "2026-04-06T15:20:00.000Z",
    });
    const secondFixture = createDeliveryFixture("telegram.bot_api");
    const failed = enqueueReminderDelivery(db, {
      userId,
      taskId: secondFixture.task.id,
      taskReminderId: secondFixture.reminder.id,
      endpointId: secondFixture.endpoint.id,
      adapterKey: "telegram.bot_api",
      scheduledFor: "2026-04-06T15:00:00.000Z",
    });

    claimReminderDelivery(db, failed.id, "2026-04-06T15:25:00.000Z");
    markReminderDeliveryFailed(db, failed.id, "temporary", true);

    const firstChanged = suppressPendingReminderDeliveriesForTask(
      db,
      firstFixture.task.id,
    );
    const secondChanged = suppressPendingReminderDeliveriesForTask(
      db,
      secondFixture.task.id,
    );

    expect(firstChanged).toBe(1);
    expect(secondChanged).toBe(1);
    expect(getReminderDelivery(db, pending.id)?.status).toBe("suppressed");
    expect(getReminderDelivery(db, failed.id)?.status).toBe("suppressed");
  });
});

describe("retry delay helpers", () => {
  it("uses stepped retry delays", () => {
    expect(computeReminderRetryDelayMinutes(1)).toBe(1);
    expect(computeReminderRetryDelayMinutes(2)).toBe(5);
    expect(computeReminderRetryDelayMinutes(3)).toBe(15);
    expect(computeReminderRetryDelayMinutes(4)).toBe(60);
  });
});

describe("reminder delivery log", () => {
  it("lists joined delivery records scoped to a user", () => {
    const sentFixture = createDeliveryFixture("sms.twilio");
    const retryFixture = createDeliveryFixture("telegram.bot_api");
    const sentDelivery = enqueueReminderDelivery(db, {
      userId,
      taskId: sentFixture.task.id,
      taskReminderId: sentFixture.reminder.id,
      endpointId: sentFixture.endpoint.id,
      adapterKey: "sms.twilio",
      scheduledFor: "2026-04-06T15:20:00.000Z",
    });
    const retryDelivery = enqueueReminderDelivery(db, {
      userId,
      taskId: retryFixture.task.id,
      taskReminderId: retryFixture.reminder.id,
      endpointId: retryFixture.endpoint.id,
      adapterKey: "telegram.bot_api",
      scheduledFor: "2026-04-06T15:10:00.000Z",
    });

    claimReminderDelivery(db, sentDelivery.id, "2026-04-06T15:25:00.000Z");
    markReminderDeliverySent(db, sentDelivery.id, {
      providerMessageId: "msg_123",
      renderedBody: "reminder text",
    });

    claimReminderDelivery(db, retryDelivery.id, "2026-04-06T15:26:00.000Z");
    markReminderDeliveryFailed(db, retryDelivery.id, "temporary", true);

    const otherUserId = createTestUser(db).id;
    const otherTask = createTask(db, otherUserId, {
      description: "Hidden task",
      due: "2026-04-06T15:30:00.000Z",
    });
    const otherEndpoint = createReminderEndpoint(db, otherUserId, {
      adapterKey: "slack.webhook",
      label: "Other slack",
      target: "https://slack-other.test/hook",
    });
    const otherReminder = createTaskReminder(db, otherUserId, {
      taskId: otherTask.id,
      endpointId: otherEndpoint.id,
      anchor: "due",
      offsetMinutes: -10,
    });

    enqueueReminderDelivery(db, {
      userId: otherUserId,
      taskId: otherTask.id,
      taskReminderId: otherReminder.id,
      endpointId: otherEndpoint.id,
      adapterKey: "slack.webhook",
      scheduledFor: "2026-04-06T15:20:00.000Z",
    });

    const entries = listReminderDeliveryLog(db, userId, {
      status: ["sent", "failed"],
    });

    expect(entries.map((entry) => entry.id)).toEqual([
      retryDelivery.id,
      sentDelivery.id,
    ]);
    expect(entries[0]).toMatchObject({
      id: retryDelivery.id,
      status: "failed",
      error: "temporary",
      nextAttemptAt: "2026-04-06T15:27:00.000Z",
      task: {
        id: retryFixture.task.id,
        description: retryFixture.task.description,
      },
      endpoint: {
        id: retryFixture.endpoint.id,
        label: retryFixture.endpoint.label,
      },
      reminder: {
        id: retryFixture.reminder.id,
        anchor: "due",
        offsetMinutes: -10,
      },
    });
    expect(entries[1]).toMatchObject({
      id: sentDelivery.id,
      status: "sent",
      providerMessageId: "msg_123",
      renderedBody: "reminder text",
      task: {
        id: sentFixture.task.id,
        description: sentFixture.task.description,
      },
      endpoint: {
        id: sentFixture.endpoint.id,
        label: sentFixture.endpoint.label,
      },
    });
  });

  it("returns a single delivery log entry scoped to a user", () => {
    const fixture = createDeliveryFixture("discord.webhook");
    const delivery = enqueueReminderDelivery(db, {
      userId,
      taskId: fixture.task.id,
      taskReminderId: fixture.reminder.id,
      endpointId: fixture.endpoint.id,
      adapterKey: "discord.webhook",
      scheduledFor: "2026-04-06T15:20:00.000Z",
    });

    claimReminderDelivery(db, delivery.id, "2026-04-06T15:25:00.000Z");
    markReminderDeliveryFailed(db, delivery.id, "fatal", false);

    const entry = getReminderDeliveryLogEntry(db, userId, delivery.id);

    expect(entry).toMatchObject({
      id: delivery.id,
      status: "dead",
      error: "fatal",
      nextAttemptAt: null,
      task: {
        id: fixture.task.id,
        description: fixture.task.description,
      },
      endpoint: {
        id: fixture.endpoint.id,
        label: fixture.endpoint.label,
      },
      reminder: {
        id: fixture.reminder.id,
        anchor: "due",
        offsetMinutes: -10,
      },
    });
    expect(getReminderDeliveryLogEntry(db, userId + 1, delivery.id)).toBeNull();
  });
});
