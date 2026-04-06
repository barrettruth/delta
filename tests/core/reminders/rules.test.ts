import { beforeEach, describe, expect, it, vi } from "vitest";
import { createReminderEndpoint } from "@/core/reminders/endpoints";
import {
  copyTaskReminders,
  createTaskReminder,
  deleteTaskReminder,
  getTaskReminder,
  listTaskReminders,
  updateTaskReminder,
} from "@/core/reminders/rules";
import { completeTask, createTask } from "@/core/task";
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

describe("task reminder rules", () => {
  it("creates and lists task reminders", () => {
    const task = createTask(db, userId, { description: "Pay rent" });
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

    expect(reminder.taskId).toBe(task.id);
    expect(reminder.endpointId).toBe(endpoint.id);
    expect(listTaskReminders(db, userId, task.id)).toHaveLength(1);
  });

  it("updates a reminder rule", () => {
    const task = createTask(db, userId, { description: "Review PR" });
    const endpoint = createReminderEndpoint(db, userId, {
      adapterKey: "telegram.bot_api",
      label: "telegram",
      target: "1234",
    });

    const reminder = createTaskReminder(db, userId, {
      taskId: task.id,
      endpointId: endpoint.id,
      anchor: "due",
      offsetMinutes: -30,
    });

    const updated = updateTaskReminder(db, userId, reminder.id, {
      anchor: "start",
      offsetMinutes: 15,
      allDayLocalTime: "09:30",
      enabled: 0,
    });

    expect(updated).not.toBeNull();
    expect(updated?.anchor).toBe("start");
    expect(updated?.offsetMinutes).toBe(15);
    expect(updated?.allDayLocalTime).toBe("09:30");
    expect(updated?.enabled).toBe(0);
  });

  it("deletes a reminder rule", () => {
    const task = createTask(db, userId, { description: "Doctor call" });
    const endpoint = createReminderEndpoint(db, userId, {
      adapterKey: "slack.webhook",
      label: "slack",
      target: "https://hooks.slack.test/a",
    });

    const reminder = createTaskReminder(db, userId, {
      taskId: task.id,
      endpointId: endpoint.id,
      anchor: "due",
      offsetMinutes: 0,
    });

    expect(deleteTaskReminder(db, userId, reminder.id)).toBe(true);
    expect(getTaskReminder(db, userId, reminder.id)).toBeNull();
  });

  it("copies reminder rules from one task to another", () => {
    const source = createTask(db, userId, { description: "Source task" });
    const target = createTask(db, userId, { description: "Target task" });
    const endpoint = createReminderEndpoint(db, userId, {
      adapterKey: "discord.webhook",
      label: "discord",
      target: "https://discord.test/a",
    });

    createTaskReminder(db, userId, {
      taskId: source.id,
      endpointId: endpoint.id,
      anchor: "due",
      offsetMinutes: -60,
      allDayLocalTime: "08:00",
    });

    const copied = copyTaskReminders(db, userId, source.id, target.id);

    expect(copied).toHaveLength(1);
    expect(copied[0].taskId).toBe(target.id);
    expect(copied[0].endpointId).toBe(endpoint.id);
    expect(copied[0].offsetMinutes).toBe(-60);
    expect(copied[0].allDayLocalTime).toBe("08:00");
  });

  it("copies reminder rules forward when recurring tasks spawn", () => {
    const recurring = createTask(db, userId, {
      description: "Weekly review",
      due: "2026-03-22T09:00:00.000Z",
      recurrence: "FREQ=WEEKLY",
      recurMode: "scheduled",
    });
    const endpoint = createReminderEndpoint(db, userId, {
      adapterKey: "sms.twilio",
      label: "sms",
      target: "+15125501381",
    });

    createTaskReminder(db, userId, {
      taskId: recurring.id,
      endpointId: endpoint.id,
      anchor: "due",
      offsetMinutes: -10,
    });

    const result = completeTask(db, userId, recurring.id);

    expect(result.spawnedTaskId).not.toBeNull();
    const spawnedReminders = listTaskReminders(
      db,
      userId,
      result.spawnedTaskId as number,
    );
    expect(spawnedReminders).toHaveLength(1);
    expect(spawnedReminders[0].endpointId).toBe(endpoint.id);
    expect(spawnedReminders[0].offsetMinutes).toBe(-10);
  });

  it("does not copy reminders when no recurring task is spawned", () => {
    const task = createTask(db, userId, { description: "One-off" });
    const endpoint = createReminderEndpoint(db, userId, {
      adapterKey: "telegram.bot_api",
      label: "telegram",
      target: "1234",
    });

    createTaskReminder(db, userId, {
      taskId: task.id,
      endpointId: endpoint.id,
      anchor: "due",
      offsetMinutes: 0,
    });

    const result = completeTask(db, userId, task.id);

    expect(result.spawnedTaskId).toBeNull();
  });
});
