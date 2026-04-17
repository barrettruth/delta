import { beforeEach, describe, expect, it } from "vitest";
import { addDependency } from "@/core/dag";
import { createTask, listTasks, updateTask } from "@/core/task";
import type { Db, Task } from "@/core/types";
import { computeUrgency, rankTasks } from "@/core/urgency";
import { createTestDb, createTestUser } from "../helpers";

let db: Db;
let userId: number;

function daysFromNow(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return d.toISOString();
}

function makeTask(overrides: Partial<Task> = {}): Task {
  return {
    id: 1,
    userId: 1,
    description: "Test",
    status: "pending",
    category: "Todo",
    startAt: null,
    endAt: null,
    allDay: 0,
    timezone: null,
    due: null,
    recurrence: null,
    recurMode: null,
    notes: null,
    order: 0,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    completedAt: null,
    location: null,
    locationLat: null,
    locationLon: null,
    meetingUrl: null,
    exdates: null,
    rdates: null,
    recurringTaskId: null,
    originalStartAt: null,
    sourceEventId: null,
    sourceUserId: null,
    ...overrides,
  };
}

describe("computeUrgency", () => {
  it("returns 0 for done tasks", () => {
    expect(computeUrgency(makeTask({ status: "done" }), 0, false)).toBe(0);
  });

  it("returns 0 for cancelled tasks", () => {
    expect(computeUrgency(makeTask({ status: "cancelled" }), 0, false)).toBe(0);
  });

  it("overdue tasks score higher than future tasks", () => {
    const overdue = computeUrgency(
      makeTask({ due: daysFromNow(-3) }),
      0,
      false,
    );
    const future = computeUrgency(makeTask({ due: daysFromNow(10) }), 0, false);
    expect(overdue).toBeGreaterThan(future);
  });

  it("wip tasks get a boost", () => {
    const pending = computeUrgency(makeTask({ status: "pending" }), 0, false);
    const wip = computeUrgency(makeTask({ status: "wip" }), 0, false);
    expect(wip).toBeGreaterThan(pending);
  });

  it("blocking tasks get a boost per blocked task", () => {
    const blocking0 = computeUrgency(makeTask(), 0, false);
    const blocking2 = computeUrgency(makeTask(), 2, false);
    expect(blocking2).toBeGreaterThan(blocking0);
  });

  it("blocked tasks get a large penalty", () => {
    const normal = computeUrgency(makeTask(), 0, false);
    const blocked = computeUrgency(makeTask(), 0, true);
    expect(blocked).toBeLessThan(0);
    expect(normal).toBeGreaterThan(blocked);
  });

  it("returns a near-zero score for a brand-new task with no due date", () => {
    const score = computeUrgency(
      makeTask({
        due: null,
        createdAt: new Date().toISOString(),
      }),
      0,
      false,
    );
    expect(score).toBeGreaterThanOrEqual(0);
    expect(score).toBeLessThan(1);
  });

  it("caps age coefficient at 1.0 for a task pending over a year", () => {
    const oneYearAgo = new Date();
    oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 2);
    const score = computeUrgency(
      makeTask({
        due: null,
        createdAt: oneYearAgo.toISOString(),
      }),
      0,
      false,
    );
    expect(score).toBeCloseTo(2.0, 1);
  });
});

describe("rankTasks", () => {
  beforeEach(() => {
    db = createTestDb();
    userId = createTestUser(db).id;
  });

  it("sorts tasks by urgency descending", () => {
    createTask(db, userId, { description: "Low" });
    createTask(db, userId, {
      description: "Urgent",
      due: daysFromNow(1),
      status: "wip",
    });
    createTask(db, userId, { description: "Medium", due: daysFromNow(5) });

    const tasks = listTasks(db, userId);
    const ranked = rankTasks(db, tasks);

    expect(ranked[0].description).toBe("Urgent");
    expect(ranked[0].urgency).toBeGreaterThan(
      ranked[ranked.length - 1].urgency,
    );
  });

  it("excludes done and cancelled tasks", () => {
    createTask(db, userId, { description: "Active" });
    const done = createTask(db, userId, { description: "Done" });
    updateTask(db, done.id, { status: "done" });

    const tasks = listTasks(db, userId);
    const ranked = rankTasks(db, tasks);

    expect(ranked.every((t) => t.status !== "done")).toBe(true);
  });

  it("keeps active tasks even when urgency is zero", () => {
    createTask(db, userId, { description: "New pending task" });

    const tasks = listTasks(db, userId);
    const ranked = rankTasks(db, tasks);

    expect(ranked.map((t) => t.description)).toContain("New pending task");
  });

  it("accounts for blocking relationships", () => {
    const blocker = createTask(db, userId, {
      description: "Blocker",
    });
    const dependent = createTask(db, userId, {
      description: "Dependent",
    });
    addDependency(db, dependent.id, blocker.id);

    const tasks = listTasks(db, userId);
    const ranked = rankTasks(db, tasks);

    const blockerRank = ranked.find((t) => t.id === blocker.id);
    expect(blockerRank).toBeDefined();
    expect(blockerRank?.urgency).toBeGreaterThan(0);
  });
});
