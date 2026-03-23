import { beforeEach, describe, expect, it } from "vitest";
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

describe("createTask", () => {
  it("creates a task with defaults", () => {
    const task = createTask(db, userId, { description: "Buy groceries" });
    expect(task.id).toBe(1);
    expect(task.userId).toBe(userId);
    expect(task.description).toBe("Buy groceries");
    expect(task.status).toBe("pending");
    expect(task.category).toBe("Todo");
    expect(task.priority).toBe(0);
    expect(task.due).toBeNull();
    expect(task.recurrence).toBeNull();
    expect(task.notes).toBeNull();
    expect(task.order).toBe(0);
    expect(task.createdAt).toBeTruthy();
    expect(task.updatedAt).toBeTruthy();
    expect(task.completedAt).toBeNull();
  });

  it("creates a task with all fields", () => {
    const task = createTask(db, userId, {
      description: "Review PR",
      status: "wip",
      category: "Open Source",
      priority: 3,
      due: "2026-04-01T09:00:00.000Z",
      recurrence: "FREQ=WEEKLY;BYDAY=MO",
      recurMode: "scheduled",
      notes: "Check the tests",
      order: 5,
    });
    expect(task.description).toBe("Review PR");
    expect(task.status).toBe("wip");
    expect(task.category).toBe("Open Source");
    expect(task.priority).toBe(3);
    expect(task.due).toBe("2026-04-01T09:00:00.000Z");
    expect(task.recurrence).toBe("FREQ=WEEKLY;BYDAY=MO");
    expect(task.recurMode).toBe("scheduled");
    expect(task.notes).toBe("Check the tests");
    expect(task.order).toBe(5);
  });

  it("auto-increments ids", () => {
    const t1 = createTask(db, userId, { description: "First" });
    const t2 = createTask(db, userId, { description: "Second" });
    expect(t2.id).toBe(t1.id + 1);
  });
});

describe("getTask", () => {
  it("returns task by id", () => {
    const created = createTask(db, userId, { description: "Test" });
    const found = getTask(db, created.id);
    expect(found).toEqual(created);
  });

  it("returns undefined for nonexistent id", () => {
    expect(getTask(db, 999)).toBeUndefined();
  });
});

describe("listTasks", () => {
  beforeEach(() => {
    createTask(db, userId, {
      description: "A",
      status: "pending",
      category: "Work",
      priority: 1,
      due: "2026-04-01T00:00:00.000Z",
    });
    createTask(db, userId, {
      description: "B",
      status: "done",
      category: "Personal",
      priority: 3,
      due: "2026-03-15T00:00:00.000Z",
    });
    createTask(db, userId, {
      description: "C",
      status: "pending",
      category: "Work",
      priority: 2,
      due: "2026-05-01T00:00:00.000Z",
    });
  });

  it("returns all tasks for user", () => {
    expect(listTasks(db, userId)).toHaveLength(3);
  });

  it("does not return other users tasks", () => {
    const other = createTestUser(db);
    createTask(db, other.id, { description: "Other" });
    expect(listTasks(db, userId)).toHaveLength(3);
    expect(listTasks(db, other.id)).toHaveLength(1);
  });

  it("filters by status", () => {
    const result = listTasks(db, userId, { status: "pending" });
    expect(result).toHaveLength(2);
    expect(result.every((t) => t.status === "pending")).toBe(true);
  });

  it("filters by multiple statuses", () => {
    const result = listTasks(db, userId, { status: ["pending", "done"] });
    expect(result).toHaveLength(3);
  });

  it("filters by category", () => {
    const result = listTasks(db, userId, { category: "Work" });
    expect(result).toHaveLength(2);
  });

  it("filters by due date range", () => {
    const result = listTasks(db, userId, {
      dueAfter: "2026-03-20T00:00:00.000Z",
      dueBefore: "2026-04-15T00:00:00.000Z",
    });
    expect(result).toHaveLength(1);
    expect(result[0].description).toBe("A");
  });

  it("filters by minimum priority", () => {
    const result = listTasks(db, userId, { minPriority: 2 });
    expect(result).toHaveLength(2);
  });

  it("sorts by priority descending", () => {
    const result = listTasks(db, userId, {
      sortBy: "priority",
      sortOrder: "desc",
    });
    expect(result[0].priority).toBe(3);
    expect(result[1].priority).toBe(2);
    expect(result[2].priority).toBe(1);
  });

  it("sorts by due date ascending", () => {
    const result = listTasks(db, userId, { sortBy: "due", sortOrder: "asc" });
    expect(result[0].description).toBe("B");
    expect(result[2].description).toBe("C");
  });

  it("combines status, category, and due range filters", () => {
    const result = listTasks(db, userId, {
      status: "pending",
      category: "Work",
      dueAfter: "2026-03-20T00:00:00.000Z",
      dueBefore: "2026-04-15T00:00:00.000Z",
    });
    expect(result).toHaveLength(1);
    expect(result[0].description).toBe("A");
    expect(result[0].status).toBe("pending");
    expect(result[0].category).toBe("Work");
  });
});

describe("updateTask", () => {
  it("updates description", async () => {
    const task = createTask(db, userId, { description: "Old" });
    await new Promise((r) => setTimeout(r, 5));
    const updated = updateTask(db, task.id, { description: "New" });
    expect(updated.description).toBe("New");
    expect(updated.updatedAt).not.toBe(task.updatedAt);
  });

  it("sets completedAt when completing", () => {
    const task = createTask(db, userId, { description: "Test" });
    const updated = updateTask(db, task.id, { status: "done" });
    expect(updated.completedAt).toBeTruthy();
  });

  it("clears completedAt when reopening", () => {
    const task = createTask(db, userId, { description: "Test" });
    updateTask(db, task.id, { status: "done" });
    const reopened = updateTask(db, task.id, { status: "pending" });
    expect(reopened.completedAt).toBeNull();
  });

  it("throws for nonexistent task", () => {
    expect(() => updateTask(db, 999, { description: "X" })).toThrow(
      "Task 999 not found",
    );
  });

  it("updates an already-done task without changing completedAt", () => {
    const task = createTask(db, userId, { description: "Test" });
    const done = updateTask(db, task.id, { status: "done" });
    const updated = updateTask(db, task.id, {
      description: "Updated done task",
    });
    expect(updated.description).toBe("Updated done task");
    expect(updated.status).toBe("done");
    expect(updated.completedAt).toBe(done.completedAt);
  });

  it("re-completing an already-done task preserves completedAt", () => {
    const task = createTask(db, userId, { description: "Test" });
    const done = updateTask(db, task.id, { status: "done" });
    const reDone = updateTask(db, task.id, { status: "done" });
    expect(reDone.completedAt).toBe(done.completedAt);
  });

  it("accepts empty string description via updateTask", () => {
    const task = createTask(db, userId, { description: "Original" });
    const updated = updateTask(db, task.id, { description: "" });
    expect(updated.description).toBe("");
  });

  it("accepts negative priority via updateTask", () => {
    const task = createTask(db, userId, { description: "Test" });
    const updated = updateTask(db, task.id, { priority: -1 });
    expect(updated.priority).toBe(-1);
  });
});

describe("completeTask", () => {
  it("sets status to done with completedAt", () => {
    const task = createTask(db, userId, { description: "Test" });
    const completed = completeTask(db, userId, task.id);
    expect(completed.status).toBe("done");
    expect(completed.completedAt).toBeTruthy();
  });

  it("spawns recurring task on completion", () => {
    createTask(db, userId, {
      description: "Weekly review",
      due: "2026-03-22T09:00:00.000Z",
      recurrence: "FREQ=WEEKLY",
      recurMode: "scheduled",
    });
    completeTask(db, userId, 1);

    const all = listTasks(db, userId);
    expect(all).toHaveLength(2);

    const spawned = all.find((t) => t.status === "pending");
    expect(spawned).toBeDefined();
    expect(spawned?.description).toBe("Weekly review");
    expect(spawned?.recurrence).toBe("FREQ=WEEKLY");
    expect(new Date(spawned?.due ?? "").getTime()).toBeGreaterThan(
      new Date("2026-03-22T09:00:00.000Z").getTime(),
    );
  });
});

describe("deleteTask", () => {
  it("soft deletes by setting status to cancelled", () => {
    const task = createTask(db, userId, { description: "Test" });
    const deleted = deleteTask(db, task.id);
    expect(deleted.status).toBe("cancelled");
    expect(deleted.completedAt).toBeTruthy();
  });
});
