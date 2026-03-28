import { beforeEach, describe, expect, it } from "vitest";
import {
  deleteAllInstances,
  deleteThisAndFuture,
  deleteThisInstance,
  editAllInstances,
  editThisAndFuture,
  editThisInstance,
} from "@/core/recurrence-editing";
import { expandInstances } from "@/core/recurrence-expansion";
import { createTask, getTask, listTasks } from "@/core/task";
import type { Db } from "@/core/types";
import { createTestDb, createTestUser } from "../helpers";

let db: Db;
let userId: number;

beforeEach(() => {
  db = createTestDb();
  userId = createTestUser(db).id;
});

function makeWeeklyMaster() {
  return createTask(db, userId, {
    description: "Weekly standup",
    startAt: "2026-03-02T14:00:00.000Z",
    endAt: "2026-03-02T15:00:00.000Z",
    recurrence: "FREQ=WEEKLY;BYDAY=MO",
    recurMode: "scheduled",
  });
}

describe("editThisInstance", () => {
  it("creates an exception and adds EXDATE to master", () => {
    const master = makeWeeklyMaster();
    const exception = editThisInstance(
      db,
      userId,
      master.id,
      "2026-03-09T14:00:00.000Z",
      { description: "Special standup" },
    );

    expect(exception.description).toBe("Special standup");
    expect(exception.recurringTaskId).toBe(master.id);
    expect(exception.originalStartAt).toBe("2026-03-09T14:00:00.000Z");

    const updated = getTask(db, master.id)!;
    const exdates: string[] = JSON.parse(updated.exdates!);
    expect(exdates).toContain("2026-03-09T14:00:00.000Z");
  });

  it("preserves master fields when only some are overridden", () => {
    const master = makeWeeklyMaster();
    const exception = editThisInstance(
      db,
      userId,
      master.id,
      "2026-03-09T14:00:00.000Z",
      { startAt: "2026-03-09T16:00:00.000Z" },
    );

    expect(exception.description).toBe("Weekly standup");
    expect(exception.startAt).toBe("2026-03-09T16:00:00.000Z");
    expect(exception.endAt).toBe("2026-03-09T15:00:00.000Z");
  });

  it("removes the instance from master's expansion", () => {
    const master = makeWeeklyMaster();
    editThisInstance(
      db,
      userId,
      master.id,
      "2026-03-09T14:00:00.000Z",
      { description: "Modified" },
    );

    const updated = getTask(db, master.id)!;
    const instances = expandInstances(
      updated,
      new Date("2026-03-01T00:00:00Z"),
      new Date("2026-03-15T23:59:59Z"),
      [],
    );
    const dates = instances.map((i) => i.instanceDate.toISOString());
    expect(dates).not.toContain("2026-03-09T14:00:00.000Z");
  });
});

describe("editThisAndFuture", () => {
  it("truncates master RRULE and creates new master", () => {
    const master = makeWeeklyMaster();
    const newMaster = editThisAndFuture(
      db,
      userId,
      master.id,
      "2026-03-16T14:00:00.000Z",
      { description: "New standup format" },
    );

    expect(newMaster.description).toBe("New standup format");
    expect(newMaster.recurrence).toBe("FREQ=WEEKLY;BYDAY=MO");

    const oldMaster = getTask(db, master.id)!;
    expect(oldMaster.recurrence).toContain("UNTIL=");

    const oldInstances = expandInstances(
      oldMaster,
      new Date("2026-03-01T00:00:00Z"),
      new Date("2026-04-30T23:59:59Z"),
      [],
    );
    for (const inst of oldInstances) {
      expect(inst.instanceDate.getTime()).toBeLessThan(
        new Date("2026-03-16T14:00:00.000Z").getTime(),
      );
    }
  });

  it("re-parents future exceptions to new master", () => {
    const master = makeWeeklyMaster();
    const futureExc = createTask(db, userId, {
      description: "Future exception",
      recurringTaskId: master.id,
      originalStartAt: "2026-03-23T14:00:00.000Z",
      startAt: "2026-03-23T16:00:00.000Z",
    });

    const newMaster = editThisAndFuture(
      db,
      userId,
      master.id,
      "2026-03-16T14:00:00.000Z",
      { description: "New format" },
    );

    const reparented = getTask(db, futureExc.id)!;
    expect(reparented.recurringTaskId).toBe(newMaster.id);
  });

  it("does not re-parent past exceptions", () => {
    const master = makeWeeklyMaster();
    const pastExc = createTask(db, userId, {
      description: "Past exception",
      recurringTaskId: master.id,
      originalStartAt: "2026-03-09T14:00:00.000Z",
      startAt: "2026-03-09T16:00:00.000Z",
    });

    editThisAndFuture(
      db,
      userId,
      master.id,
      "2026-03-16T14:00:00.000Z",
      { description: "New format" },
    );

    const unchanged = getTask(db, pastExc.id)!;
    expect(unchanged.recurringTaskId).toBe(master.id);
  });
});

describe("editAllInstances", () => {
  it("modifies the master task directly", () => {
    const master = makeWeeklyMaster();
    const updated = editAllInstances(db, userId, master.id, {
      description: "Renamed standup",
    });
    expect(updated.description).toBe("Renamed standup");
    expect(updated.id).toBe(master.id);
  });
});

describe("deleteThisInstance", () => {
  it("adds EXDATE to master", () => {
    const master = makeWeeklyMaster();
    deleteThisInstance(db, userId, master.id, "2026-03-09T14:00:00.000Z");

    const updated = getTask(db, master.id)!;
    const exdates: string[] = JSON.parse(updated.exdates!);
    expect(exdates).toContain("2026-03-09T14:00:00.000Z");
  });

  it("cancels existing exception if present", () => {
    const master = makeWeeklyMaster();
    const exc = createTask(db, userId, {
      description: "Exception",
      recurringTaskId: master.id,
      originalStartAt: "2026-03-09T14:00:00.000Z",
      startAt: "2026-03-09T16:00:00.000Z",
    });

    deleteThisInstance(db, userId, master.id, "2026-03-09T14:00:00.000Z");

    const cancelled = getTask(db, exc.id)!;
    expect(cancelled.status).toBe("cancelled");
  });

  it("works when no exception exists", () => {
    const master = makeWeeklyMaster();
    expect(() =>
      deleteThisInstance(db, userId, master.id, "2026-03-09T14:00:00.000Z"),
    ).not.toThrow();
  });
});

describe("deleteThisAndFuture", () => {
  it("truncates master RRULE with UNTIL", () => {
    const master = makeWeeklyMaster();
    deleteThisAndFuture(db, userId, master.id, "2026-03-16T14:00:00.000Z");

    const updated = getTask(db, master.id)!;
    expect(updated.recurrence).toContain("UNTIL=");
  });

  it("cancels future exceptions", () => {
    const master = makeWeeklyMaster();
    const futureExc = createTask(db, userId, {
      description: "Future",
      recurringTaskId: master.id,
      originalStartAt: "2026-03-23T14:00:00.000Z",
      startAt: "2026-03-23T16:00:00.000Z",
    });

    deleteThisAndFuture(db, userId, master.id, "2026-03-16T14:00:00.000Z");

    const cancelled = getTask(db, futureExc.id)!;
    expect(cancelled.status).toBe("cancelled");
  });

  it("does not cancel past exceptions", () => {
    const master = makeWeeklyMaster();
    const pastExc = createTask(db, userId, {
      description: "Past",
      recurringTaskId: master.id,
      originalStartAt: "2026-03-09T14:00:00.000Z",
      startAt: "2026-03-09T16:00:00.000Z",
    });

    deleteThisAndFuture(db, userId, master.id, "2026-03-16T14:00:00.000Z");

    const unchanged = getTask(db, pastExc.id)!;
    expect(unchanged.status).toBe("pending");
  });
});

describe("deleteAllInstances", () => {
  it("cancels master and all exceptions", () => {
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

    deleteAllInstances(db, master.id);

    const all = listTasks(db, userId);
    expect(all.every((t) => t.status === "cancelled")).toBe(true);
  });
});
