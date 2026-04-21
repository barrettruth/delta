import { beforeEach, describe, expect, it } from "vitest";
import {
  buildRRuleSet,
  expandInstances,
  getExceptionsForMaster,
  materializeInstance,
} from "@/core/recurrence-expansion";
import { createTask, getTask } from "@/core/task";
import type { Db, Task } from "@/core/types";
import { createTestDb, createTestUser } from "../helpers";

let db: Db;
let userId: number;

beforeEach(() => {
  db = createTestDb();
  userId = createTestUser(db).id;
});

function makeWeeklyMaster(overrides: Record<string, unknown> = {}): Task {
  return createTask(db, userId, {
    description: "Weekly standup",
    startAt: "2026-03-02T14:00:00.000Z",
    endAt: "2026-03-02T15:00:00.000Z",
    recurrence: "FREQ=WEEKLY;BYDAY=MO",
    recurMode: "scheduled",
    ...overrides,
  });
}

describe("buildRRuleSet", () => {
  it("builds a set from a task with RRULE", () => {
    const master = makeWeeklyMaster();
    const set = buildRRuleSet(master);
    expect(set).toBeDefined();
    const dates = set.between(
      new Date("2026-03-01T00:00:00Z"),
      new Date("2026-03-31T23:59:59Z"),
      true,
    );
    expect(dates.length).toBe(5);
  });

  it("excludes EXDATE entries", () => {
    const master = makeWeeklyMaster({
      exdates: JSON.stringify(["2026-03-09T14:00:00.000Z"]),
    });
    const set = buildRRuleSet(master);
    const dates = set.between(
      new Date("2026-03-01T00:00:00Z"),
      new Date("2026-03-31T23:59:59Z"),
      true,
    );
    expect(dates.length).toBe(4);
    const isoStrings = dates.map((d) => d.toISOString());
    expect(isoStrings).not.toContain("2026-03-09T14:00:00.000Z");
  });

  it("includes RDATE entries", () => {
    const master = makeWeeklyMaster({
      rdates: JSON.stringify(["2026-03-04T14:00:00.000Z"]),
    });
    const set = buildRRuleSet(master);
    const dates = set.between(
      new Date("2026-03-01T00:00:00Z"),
      new Date("2026-03-31T23:59:59Z"),
      true,
    );
    expect(dates.length).toBe(6);
  });

  it("throws for task without recurrence", () => {
    const task = createTask(db, userId, { description: "No recurrence" });
    expect(() => buildRRuleSet(task)).toThrow("Task has no recurrence rule");
  });
});

describe("expandInstances", () => {
  it("expands weekly rule into instances for a date range", () => {
    const master = makeWeeklyMaster();
    const instances = expandInstances(
      master,
      new Date("2026-03-01T00:00:00Z"),
      new Date("2026-03-31T23:59:59Z"),
      [],
    );
    expect(instances.length).toBe(5);
    expect(instances[0].masterId).toBe(master.id);
    expect(instances[0].exception).toBeNull();
  });

  it("preserves duration on expanded instances", () => {
    const master = makeWeeklyMaster();
    const instances = expandInstances(
      master,
      new Date("2026-03-01T00:00:00Z"),
      new Date("2026-03-08T23:59:59Z"),
      [],
    );
    expect(instances.length).toBe(1);
    const inst = instances[0];
    const startMs = new Date(inst.startAt).getTime();
    const endMs = new Date(inst.endAt!).getTime();
    expect(endMs - startMs).toBe(60 * 60 * 1000);
  });

  it("returns empty for non-recurring task", () => {
    const task = createTask(db, userId, { description: "Plain task" });
    const instances = expandInstances(
      task,
      new Date("2026-03-01T00:00:00Z"),
      new Date("2026-03-31T23:59:59Z"),
      [],
    );
    expect(instances).toEqual([]);
  });

  it("skips EXDATE instances", () => {
    const master = makeWeeklyMaster({
      exdates: JSON.stringify(["2026-03-09T14:00:00.000Z"]),
    });
    const instances = expandInstances(
      master,
      new Date("2026-03-01T00:00:00Z"),
      new Date("2026-03-31T23:59:59Z"),
      [],
    );
    expect(instances.length).toBe(4);
    const starts = instances.map((i) => i.startAt);
    expect(starts).not.toContain("2026-03-09T14:00:00.000Z");
  });

  it("uses exception data when an exception matches", () => {
    const master = makeWeeklyMaster();
    const exception = createTask(db, userId, {
      description: "Modified standup",
      startAt: "2026-03-09T15:00:00.000Z",
      endAt: "2026-03-09T16:00:00.000Z",
      recurringTaskId: master.id,
      originalStartAt: "2026-03-09T14:00:00.000Z",
    });

    const instances = expandInstances(
      master,
      new Date("2026-03-01T00:00:00Z"),
      new Date("2026-03-15T23:59:59Z"),
      [exception],
    );

    const march9 = instances.find(
      (i) => i.instanceDate.toISOString() === "2026-03-09T14:00:00.000Z",
    );
    expect(march9).toBeDefined();
    expect(march9?.exception).not.toBeNull();
    expect(march9?.startAt).toBe("2026-03-09T15:00:00.000Z");
    expect(march9?.endAt).toBe("2026-03-09T16:00:00.000Z");
  });

  it("keeps rendering exceptions when the master excludes the original date", () => {
    const master = makeWeeklyMaster({
      exdates: JSON.stringify(["2026-03-09T14:00:00.000Z"]),
    });
    const exception = createTask(db, userId, {
      description: "Materialized standup",
      startAt: "2026-03-09T14:00:00.000Z",
      endAt: "2026-03-09T15:00:00.000Z",
      recurringTaskId: master.id,
      originalStartAt: "2026-03-09T14:00:00.000Z",
    });

    const instances = expandInstances(
      master,
      new Date("2026-03-01T00:00:00Z"),
      new Date("2026-03-15T23:59:59Z"),
      [exception],
    );

    const march9 = instances.find(
      (i) => i.startAt === "2026-03-09T14:00:00.000Z",
    );
    expect(march9).toBeDefined();
    expect(march9?.exception?.id).toBe(exception.id);
  });

  it("returns empty for range with no occurrences", () => {
    const master = makeWeeklyMaster();
    const instances = expandInstances(
      master,
      new Date("2025-01-01T00:00:00Z"),
      new Date("2025-01-31T23:59:59Z"),
      [],
    );
    expect(instances.length).toBe(0);
  });
});

describe("materializeInstance", () => {
  it("creates an exception task from master", () => {
    const master = makeWeeklyMaster();
    const instance = materializeInstance(
      db,
      userId,
      master.id,
      "2026-03-09T14:00:00.000Z",
    );

    expect(instance.recurringTaskId).toBe(master.id);
    expect(instance.originalStartAt).toBe("2026-03-09T14:00:00.000Z");
    expect(instance.startAt).toBe("2026-03-09T14:00:00.000Z");
    expect(instance.description).toBe("Weekly standup");
  });

  it("preserves duration", () => {
    const master = makeWeeklyMaster();
    const instance = materializeInstance(
      db,
      userId,
      master.id,
      "2026-03-09T14:00:00.000Z",
    );
    const startMs = new Date(instance.startAt!).getTime();
    const endMs = new Date(instance.endAt!).getTime();
    expect(endMs - startMs).toBe(60 * 60 * 1000);
  });

  it("adds EXDATE to master", () => {
    const master = makeWeeklyMaster();
    materializeInstance(db, userId, master.id, "2026-03-09T14:00:00.000Z");

    const updated = getTask(db, master.id)!;
    const exdates: string[] = JSON.parse(updated.exdates!);
    expect(exdates).toContain("2026-03-09T14:00:00.000Z");
  });

  it("throws for nonexistent master", () => {
    expect(() =>
      materializeInstance(db, userId, 999, "2026-03-09T14:00:00.000Z"),
    ).toThrow("Master task 999 not found");
  });

  it("throws for non-recurring master", () => {
    const task = createTask(db, userId, { description: "Plain" });
    expect(() =>
      materializeInstance(db, userId, task.id, "2026-03-09T14:00:00.000Z"),
    ).toThrow("Task has no recurrence rule");
  });
});

describe("getExceptionsForMaster", () => {
  it("returns exceptions linked to master", () => {
    const master = makeWeeklyMaster();
    createTask(db, userId, {
      description: "Exception 1",
      recurringTaskId: master.id,
      originalStartAt: "2026-03-09T14:00:00.000Z",
    });
    createTask(db, userId, {
      description: "Exception 2",
      recurringTaskId: master.id,
      originalStartAt: "2026-03-16T14:00:00.000Z",
    });

    const exceptions = getExceptionsForMaster(db, master.id);
    expect(exceptions).toHaveLength(2);
  });

  it("returns empty for master with no exceptions", () => {
    const master = makeWeeklyMaster();
    expect(getExceptionsForMaster(db, master.id)).toHaveLength(0);
  });
});
