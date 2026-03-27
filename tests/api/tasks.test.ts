import { beforeEach, describe, expect, it } from "vitest";
import { addDependency } from "@/core/dag";
import {
  completeTask,
  createTask,
  deleteTask,
  getTask,
  listTasks,
  updateTask,
} from "@/core/task";
import type { Db } from "@/core/types";
import { createTestDb, createTestUser } from "../helpers";

let db: Db;
let userId: number;

beforeEach(() => {
  db = createTestDb();
  userId = createTestUser(db).id;
});

describe("task lifecycle", () => {
  it("create, list, update, complete, delete end-to-end", () => {
    const task = createTask(db, userId, {
      description: "Write tests",
      category: "Dev",
      due: "2026-04-01T09:00:00.000Z",
    });

    expect(task.id).toBe(1);
    expect(task.status).toBe("pending");

    const all = listTasks(db, userId);
    expect(all).toHaveLength(1);
    expect(all[0].id).toBe(task.id);

    const updated = updateTask(db, task.id, {
      description: "Write integration tests",
    });
    expect(updated.description).toBe("Write integration tests");
    expect(updated.updatedAt).not.toBe(task.updatedAt);

    const { task: completed } = completeTask(db, userId, task.id);
    expect(completed.status).toBe("done");
    expect(completed.completedAt).toBeTruthy();

    const afterComplete = listTasks(db, userId);
    expect(afterComplete).toHaveLength(1);
    expect(afterComplete[0].status).toBe("done");
  });

  it("creates multiple tasks and lists them all", () => {
    createTask(db, userId, { description: "Task 1" });
    createTask(db, userId, { description: "Task 2" });
    createTask(db, userId, { description: "Task 3" });

    const all = listTasks(db, userId);
    expect(all).toHaveLength(3);
  });

  it("soft deletes via deleteTask", () => {
    const task = createTask(db, userId, { description: "Doomed" });
    const deleted = deleteTask(db, task.id);

    expect(deleted.status).toBe("cancelled");
    expect(deleted.completedAt).toBeTruthy();

    const fetched = getTask(db, deleted.id);
    expect(fetched?.status).toBe("cancelled");
  });
});

describe("status transitions", () => {
  it("pending -> wip -> done", () => {
    const task = createTask(db, userId, { description: "Flow test" });
    expect(task.status).toBe("pending");

    const wip = updateTask(db, task.id, { status: "wip" });
    expect(wip.status).toBe("wip");
    expect(wip.completedAt).toBeNull();

    const done = updateTask(db, task.id, { status: "done" });
    expect(done.status).toBe("done");
    expect(done.completedAt).toBeTruthy();
  });

  it("pending -> blocked via dependency -> pending via auto-unblock", () => {
    const blocker = createTask(db, userId, { description: "Blocker" });
    const blocked = createTask(db, userId, { description: "Blocked" });

    addDependency(db, blocked.id, blocker.id);
    expect(getTask(db, blocked.id)?.status).toBe("blocked");

    completeTask(db, userId, blocker.id);
    expect(getTask(db, blocked.id)?.status).toBe("pending");
  });

  it("done -> pending clears completedAt", () => {
    const task = createTask(db, userId, { description: "Reopenable" });
    const done = updateTask(db, task.id, { status: "done" });
    expect(done.completedAt).toBeTruthy();

    const reopened = updateTask(db, task.id, { status: "pending" });
    expect(reopened.status).toBe("pending");
    expect(reopened.completedAt).toBeNull();
  });

  it("cancelled -> wip clears completedAt", () => {
    const task = createTask(db, userId, { description: "Revived" });
    const cancelled = deleteTask(db, task.id);
    expect(cancelled.completedAt).toBeTruthy();

    const revived = updateTask(db, task.id, { status: "wip" });
    expect(revived.status).toBe("wip");
    expect(revived.completedAt).toBeNull();
  });
});

describe("listing filters", () => {
  beforeEach(() => {
    createTask(db, userId, {
      description: "Work task",
      status: "pending",
      category: "Work",
      due: "2026-04-01T00:00:00.000Z",
    });
    createTask(db, userId, {
      description: "Personal task",
      status: "done",
      category: "Personal",
      due: "2026-03-15T00:00:00.000Z",
    });
    createTask(db, userId, {
      description: "Urgent work",
      status: "wip",
      category: "Work",
      due: "2026-03-20T00:00:00.000Z",
    });
    createTask(db, userId, {
      description: "Low prio",
      status: "pending",
      category: "Personal",
    });
  });

  it("filters by single status", () => {
    const pending = listTasks(db, userId, { status: "pending" });
    expect(pending).toHaveLength(2);
    expect(pending.every((t) => t.status === "pending")).toBe(true);
  });

  it("filters by multiple statuses", () => {
    const active = listTasks(db, userId, { status: ["pending", "wip"] });
    expect(active).toHaveLength(3);
    expect(
      active.every((t) => t.status === "pending" || t.status === "wip"),
    ).toBe(true);
  });

  it("filters by category", () => {
    const work = listTasks(db, userId, { category: "Work" });
    expect(work).toHaveLength(2);
    expect(work.every((t) => t.category === "Work")).toBe(true);
  });

  it("filters by due date range", () => {
    const range = listTasks(db, userId, {
      dueAfter: "2026-03-18T00:00:00.000Z",
      dueBefore: "2026-03-25T00:00:00.000Z",
    });
    expect(range).toHaveLength(1);
    expect(range[0].description).toBe("Urgent work");
  });

  it("combines status and category filters", () => {
    const result = listTasks(db, userId, {
      status: "pending",
      category: "Personal",
    });
    expect(result).toHaveLength(1);
    expect(result[0].description).toBe("Low prio");
  });

  it("sorts by due ascending", () => {
    const sorted = listTasks(db, userId, { sortBy: "due", sortOrder: "asc" });
    const withDue = sorted.filter((t) => t.due !== null);
    for (let i = 1; i < withDue.length; i++) {
      expect((withDue[i].due ?? "") >= (withDue[i - 1].due ?? "")).toBe(true);
    }
  });

  it("returns empty array when no tasks match", () => {
    const result = listTasks(db, userId, { category: "NonexistentCategory" });
    expect(result).toHaveLength(0);
  });
});

describe("recurring task completion", () => {
  it("spawns a new pending task with next due date", () => {
    createTask(db, userId, {
      description: "Weekly standup",
      due: "2026-03-22T09:00:00.000Z",
      recurrence: "FREQ=WEEKLY",
      recurMode: "scheduled",
      category: "Work",
    });

    completeTask(db, userId, 1);

    const all = listTasks(db, userId);
    expect(all).toHaveLength(2);

    const original = all.find((t) => t.status === "done");
    const spawned = all.find((t) => t.status === "pending");

    expect(original).toBeDefined();
    expect(spawned).toBeDefined();
    expect(spawned?.description).toBe("Weekly standup");
    expect(spawned?.recurrence).toBe("FREQ=WEEKLY");
    expect(spawned?.recurMode).toBe("scheduled");
    expect(spawned?.category).toBe("Work");
    expect(new Date(spawned?.due ?? "").getTime()).toBeGreaterThan(
      new Date("2026-03-22T09:00:00.000Z").getTime(),
    );
  });

  it("does not spawn when task has no recurrence", () => {
    createTask(db, userId, { description: "One-off task" });
    completeTask(db, userId, 1);

    const all = listTasks(db, userId);
    expect(all).toHaveLength(1);
    expect(all[0].status).toBe("done");
  });

  it("handles completion-based recurrence", () => {
    createTask(db, userId, {
      description: "Water plants",
      due: "2026-03-20T08:00:00.000Z",
      recurrence: "FREQ=WEEKLY",
      recurMode: "completion",
    });

    completeTask(db, userId, 1);

    const all = listTasks(db, userId);
    expect(all).toHaveLength(2);

    const spawned = all.find((t) => t.status === "pending");
    expect(spawned?.recurMode).toBe("completion");
    const spawnedDue = new Date(spawned?.due ?? "").getTime();
    expect(spawnedDue).toBeGreaterThan(Date.now() - 60_000);
  });

  it("spawns daily recurring task", () => {
    createTask(db, userId, {
      description: "Daily review",
      due: "2026-03-22T18:00:00.000Z",
      recurrence: "FREQ=DAILY",
      recurMode: "scheduled",
    });

    completeTask(db, userId, 1);

    const all = listTasks(db, userId);
    expect(all).toHaveLength(2);

    const spawned = all.find((t) => t.status === "pending");
    const spawnedDate = new Date(spawned?.due ?? "");
    const originalDate = new Date("2026-03-22T18:00:00.000Z");
    expect(spawnedDate.getTime()).toBeGreaterThan(originalDate.getTime());
  });
});
