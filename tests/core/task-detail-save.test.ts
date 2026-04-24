import { beforeEach, describe, expect, it } from "vitest";
import { createReminderEndpoint } from "@/core/reminders/endpoints";
import { createTaskReminder, listTaskReminders } from "@/core/reminders/rules";
import { createTask, getTask } from "@/core/task";
import { saveTaskDetails } from "@/core/task-detail-save";
import type { Db } from "@/core/types";
import { createTestDb, createTestUser } from "../helpers";

let db: Db;
let userId: number;

beforeEach(() => {
  process.env.INTEGRATION_ENCRYPTION_KEY = "1".repeat(64);
  db = createTestDb();
  userId = createTestUser(db).id;
});

describe("saveTaskDetails", () => {
  it("updates the task and reminder set in one call", () => {
    const task = createTask(db, userId, { description: "Old title" });
    const endpoint = createReminderEndpoint(db, userId, {
      adapterKey: "telegram.bot_api",
      label: "Telegram",
      target: "chat-1",
    });
    const reminder = createTaskReminder(db, userId, {
      taskId: task.id,
      endpointId: endpoint.id,
      anchor: "due",
      offsetMinutes: -15,
    });

    const result = saveTaskDetails(db, userId, task.id, {
      task: { description: "New title" },
      reminders: [
        {
          clientId: "existing",
          id: reminder.id,
          endpointId: endpoint.id,
          anchor: "start",
          offsetMinutes: 0,
          allDayLocalTime: null,
          enabled: 1,
        },
        {
          clientId: "created",
          id: null,
          endpointId: endpoint.id,
          anchor: "due",
          offsetMinutes: 30,
          allDayLocalTime: null,
          enabled: 1,
        },
      ],
    });

    expect(result.task.description).toBe("New title");
    expect(result.reminders).toHaveLength(2);
    expect(result.reminders[0].anchor).toBe("start");
    expect(result.reminders[1].id).toBeGreaterThan(reminder.id);

    const persisted = listTaskReminders(db, userId, task.id);
    expect(persisted).toHaveLength(2);
    expect(persisted.map((item) => item.offsetMinutes)).toEqual([0, 30]);
  });

  it("rolls back the task update when reminder validation fails", () => {
    const task = createTask(db, userId, { description: "Original" });

    expect(() =>
      saveTaskDetails(db, userId, task.id, {
        task: { description: "Should not persist" },
        reminders: [
          {
            clientId: "broken",
            id: null,
            endpointId: 999,
            anchor: "due",
            offsetMinutes: 0,
            allDayLocalTime: null,
            enabled: 1,
          },
        ],
      }),
    ).toThrow("Reminder endpoint not found");

    expect(getTask(db, task.id)?.description).toBe("Original");
    expect(listTaskReminders(db, userId, task.id)).toHaveLength(0);
  });
});
