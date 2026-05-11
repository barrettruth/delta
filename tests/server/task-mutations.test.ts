import { beforeEach, describe, expect, it, vi } from "vitest";
import { createTask, getTask, listTasks } from "@/core/task";
import type { Db } from "@/core/types";
import {
  addDependencyForUser,
  deleteTaskForUser,
  updateTaskForUser,
} from "@/server/task-mutations";
import { createTestDb, createTestUser } from "../helpers";

vi.mock("server-only", () => ({}));

let db: Db;
let userId: number;
let otherUserId: number;

beforeEach(() => {
  db = createTestDb();
  userId = createTestUser(db).id;
  otherUserId = createTestUser(db).id;
});

describe("task mutation service", () => {
  it("updates only tasks owned by the user", () => {
    const task = createTask(db, userId, { description: "Owned" });
    const otherTask = createTask(db, otherUserId, { description: "Other" });

    const updated = updateTaskForUser(db, userId, task.id, {
      description: "Updated",
    });

    expect(updated.description).toBe("Updated");
    expect(() =>
      updateTaskForUser(db, userId, otherTask.id, {
        description: "Wrong owner",
      }),
    ).toThrow("Task not found");
    expect(getTask(db, otherTask.id)?.description).toBe("Other");
  });

  it("routes done status updates through recurring completion behavior", () => {
    const task = createTask(db, userId, {
      description: "Weekly review",
      due: "2026-05-11T12:00:00.000Z",
      recurrence: "FREQ=WEEKLY",
      recurMode: "scheduled",
    });

    const updated = updateTaskForUser(db, userId, task.id, { status: "done" });
    const tasks = listTasks(db, userId);

    expect(updated.status).toBe("done");
    expect(tasks).toHaveLength(2);
    expect(tasks.some((item) => item.status === "pending")).toBe(true);
  });

  it("requires owned dependency tasks before adding dependencies", () => {
    const task = createTask(db, userId, { description: "Owned" });
    const otherTask = createTask(db, otherUserId, { description: "Other" });

    expect(() =>
      addDependencyForUser(db, userId, task.id, otherTask.id),
    ).toThrow("Dependency task not found");
    expect(getTask(db, task.id)?.status).toBe("pending");
  });

  it("updates one recurrence instance through the shared scope flow", () => {
    const master = createTask(db, userId, {
      description: "Standup",
      startAt: "2026-05-11T14:00:00.000Z",
      endAt: "2026-05-11T14:30:00.000Z",
      recurrence: "FREQ=WEEKLY",
      recurMode: "scheduled",
    });
    const instanceDate = "2026-05-18T14:00:00.000Z";

    const exception = updateTaskForUser(
      db,
      userId,
      master.id,
      { description: "Moved standup" },
      { scope: "this", instanceDate },
    );

    expect(exception.recurringTaskId).toBe(master.id);
    expect(exception.description).toBe("Moved standup");
    expect(JSON.parse(getTask(db, master.id)?.exdates ?? "[]")).toContain(
      instanceDate,
    );
  });

  it("keeps recurrence delete response shape outside the service", () => {
    const master = createTask(db, userId, {
      description: "Standup",
      startAt: "2026-05-11T14:00:00.000Z",
      recurrence: "FREQ=WEEKLY",
      recurMode: "scheduled",
    });
    const instanceDate = "2026-05-18T14:00:00.000Z";

    const result = deleteTaskForUser(db, userId, master.id, {
      scope: "this",
      instanceDate,
    });

    expect(result).toEqual({ kind: "recurrence-scope", scope: "this" });
    expect(JSON.parse(getTask(db, master.id)?.exdates ?? "[]")).toContain(
      instanceDate,
    );
  });
});
