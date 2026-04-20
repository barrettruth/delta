import { beforeEach, describe, expect, it } from "vitest";
import { createTask } from "@/core/task";
import type { Db, Task } from "@/core/types";
import { syntheticIdFor, tasksToEvents } from "@/lib/fullcalendar-adapter";
import { createTestDb, createTestUser } from "../helpers";

let db: Db;
let userId: number;

beforeEach(() => {
  db = createTestDb();
  userId = createTestUser(db).id;
});

const RANGE_START = new Date("2026-03-01T00:00:00.000Z");
const RANGE_END = new Date("2026-03-31T23:59:59.000Z");

describe("tasksToEvents — plain tasks", () => {
  it("emits one event per non-recurring task with startAt", () => {
    const t = createTask(db, userId, {
      description: "Lunch",
      startAt: "2026-03-05T12:00:00.000Z",
      endAt: "2026-03-05T13:00:00.000Z",
    });

    const { events } = tasksToEvents([t], {
      rangeStart: RANGE_START,
      rangeEnd: RANGE_END,
    });

    expect(events).toHaveLength(1);
    expect(events[0].id).toBe(String(t.id));
    expect(events[0].title).toBe("Lunch");
    expect(events[0].start).toBe("2026-03-05T12:00:00.000Z");
    expect(events[0].end).toBe("2026-03-05T13:00:00.000Z");
    expect(events[0].allDay).toBe(false);
  });

  it("skips tasks without startAt", () => {
    const t = createTask(db, userId, { description: "No date" });
    const { events } = tasksToEvents([t], {
      rangeStart: RANGE_START,
      rangeEnd: RANGE_END,
    });
    expect(events).toHaveLength(0);
  });

  it("marks all-day tasks with allDay: true", () => {
    const t = createTask(db, userId, {
      description: "Holiday",
      startAt: "2026-03-10T00:00:00.000Z",
      allDay: 1,
    });
    const { events } = tasksToEvents([t], {
      rangeStart: RANGE_START,
      rangeEnd: RANGE_END,
    });
    expect(events[0].allDay).toBe(true);
  });
});

describe("tasksToEvents — category colors + classNames", () => {
  it("sets backgroundColor/borderColor from categoryColors", () => {
    const t = createTask(db, userId, {
      description: "Work",
      category: "Work",
      startAt: "2026-03-05T10:00:00.000Z",
    });
    const { events } = tasksToEvents([t], {
      rangeStart: RANGE_START,
      rangeEnd: RANGE_END,
      categoryColors: { Work: "#ff0000" },
    });
    expect(events[0].backgroundColor).toBe("#ff000020");
    expect(events[0].borderColor).toBe("#ff0000");
  });

  it("adds status-* and is-recurring classNames", () => {
    const t = createTask(db, userId, {
      description: "Standup",
      startAt: "2026-03-02T14:00:00.000Z",
      endAt: "2026-03-02T15:00:00.000Z",
      status: "wip",
      recurrence: "FREQ=WEEKLY;BYDAY=MO",
      recurMode: "scheduled",
    });
    const { events } = tasksToEvents([t], {
      rangeStart: RANGE_START,
      rangeEnd: RANGE_END,
    });
    expect(events.length).toBeGreaterThan(0);
    expect(events[0].classNames).toContain("status-wip");
    expect(events[0].classNames).toContain("is-recurring");
    expect(events[0].classNames).toContain("is-virtual");
  });
});

describe("tasksToEvents — recurring masters", () => {
  it("expands a weekly master into virtual instances with synthetic ids", () => {
    const master = createTask(db, userId, {
      description: "Standup",
      startAt: "2026-03-02T14:00:00.000Z",
      endAt: "2026-03-02T15:00:00.000Z",
      recurrence: "FREQ=WEEKLY;BYDAY=MO",
      recurMode: "scheduled",
    });

    const { events, virtualMeta } = tasksToEvents([master], {
      rangeStart: RANGE_START,
      rangeEnd: RANGE_END,
    });

    expect(events.length).toBe(5);
    for (const ev of events) {
      const id = Number(ev.id);
      expect(id).toBeLessThan(0);
      expect(virtualMeta.has(id)).toBe(true);
      expect(virtualMeta.get(id)?.masterId).toBe(master.id);
    }
  });

  it("does not emit an event for the master itself", () => {
    const master = createTask(db, userId, {
      description: "Standup",
      startAt: "2026-03-02T14:00:00.000Z",
      endAt: "2026-03-02T15:00:00.000Z",
      recurrence: "FREQ=WEEKLY;BYDAY=MO",
      recurMode: "scheduled",
    });

    const { events } = tasksToEvents([master], {
      rangeStart: RANGE_START,
      rangeEnd: RANGE_END,
    });

    expect(events.find((e) => e.id === String(master.id))).toBeUndefined();
  });

  it("does not expand cancelled masters (matches legacy behavior)", () => {
    const master = createTask(db, userId, {
      description: "Dead",
      startAt: "2026-03-02T14:00:00.000Z",
      recurrence: "FREQ=WEEKLY;BYDAY=MO",
      recurMode: "scheduled",
      status: "cancelled",
    });
    const { events, virtualMeta } = tasksToEvents([master], {
      rangeStart: RANGE_START,
      rangeEnd: RANGE_END,
    });
    // No virtual instances expanded, but the master row still emits once
    // (falls through to the plain-task branch — matches legacy CalendarView).
    expect(virtualMeta.size).toBe(0);
    expect(events).toHaveLength(1);
    expect(events[0].id).toBe(String(master.id));
  });

  it("skips masters with recurMode=completion (not scheduled)", () => {
    const master = createTask(db, userId, {
      description: "Chore",
      startAt: "2026-03-02T14:00:00.000Z",
      recurrence: "FREQ=WEEKLY;BYDAY=MO",
      recurMode: "completion",
    });
    const { events } = tasksToEvents([master], {
      rangeStart: RANGE_START,
      rangeEnd: RANGE_END,
    });
    // Falls through to plain-task branch -> single event for the master row.
    expect(events).toHaveLength(1);
    expect(events[0].id).toBe(String(master.id));
  });
});

describe("tasksToEvents — exceptions", () => {
  it("replaces an expanded instance with the real exception row", () => {
    const master = createTask(db, userId, {
      description: "Standup",
      startAt: "2026-03-02T14:00:00.000Z",
      endAt: "2026-03-02T15:00:00.000Z",
      recurrence: "FREQ=WEEKLY;BYDAY=MO",
      recurMode: "scheduled",
    });

    const exception = createTask(db, userId, {
      description: "Moved standup",
      startAt: "2026-03-09T16:00:00.000Z",
      endAt: "2026-03-09T17:00:00.000Z",
      recurringTaskId: master.id,
      originalStartAt: "2026-03-09T14:00:00.000Z",
    });

    const { events, virtualMeta } = tasksToEvents([master, exception], {
      rangeStart: RANGE_START,
      rangeEnd: RANGE_END,
    });

    const excEvent = events.find((e) => e.id === String(exception.id));
    expect(excEvent).toBeDefined();
    expect(excEvent?.start).toBe("2026-03-09T16:00:00.000Z");

    const virtualIds = [...virtualMeta.keys()];
    for (const id of virtualIds) {
      const meta = virtualMeta.get(id);
      expect(meta?.instanceDate).not.toBe("2026-03-09T14:00:00.000Z");
    }
  });

  it("drops cancelled exception instances", () => {
    const master = createTask(db, userId, {
      description: "Standup",
      startAt: "2026-03-02T14:00:00.000Z",
      endAt: "2026-03-02T15:00:00.000Z",
      recurrence: "FREQ=WEEKLY;BYDAY=MO",
      recurMode: "scheduled",
    });

    const cancelled = createTask(db, userId, {
      description: "Cancelled instance",
      startAt: "2026-03-09T14:00:00.000Z",
      recurringTaskId: master.id,
      originalStartAt: "2026-03-09T14:00:00.000Z",
      status: "cancelled",
    });

    const { events } = tasksToEvents([master, cancelled], {
      rangeStart: RANGE_START,
      rangeEnd: RANGE_END,
    });

    expect(events.find((e) => e.id === String(cancelled.id))).toBeUndefined();
    // 4 other virtual instances remain (March 2, 16, 23, 30).
    expect(events.length).toBe(4);
  });

  it("renders a real exception even after the master exdates it", () => {
    const master = createTask(db, userId, {
      description: "Standup",
      startAt: "2026-03-02T14:00:00.000Z",
      endAt: "2026-03-02T15:00:00.000Z",
      recurrence: "FREQ=WEEKLY;BYDAY=MO",
      recurMode: "scheduled",
      exdates: JSON.stringify(["2026-03-09T14:00:00.000Z"]),
    });

    const exception = createTask(db, userId, {
      description: "Materialized standup",
      startAt: "2026-03-09T14:00:00.000Z",
      endAt: "2026-03-09T15:00:00.000Z",
      recurringTaskId: master.id,
      originalStartAt: "2026-03-09T14:00:00.000Z",
    });

    const { events } = tasksToEvents([master, exception], {
      rangeStart: RANGE_START,
      rangeEnd: RANGE_END,
    });

    expect(events.find((e) => e.id === String(exception.id))).toBeDefined();
  });
});

describe("tasksToEvents — pendingEdits + optimisticUpdates", () => {
  it("merges pendingEdits into the emitted event", () => {
    const t = createTask(db, userId, {
      description: "Original",
      startAt: "2026-03-05T10:00:00.000Z",
    });
    const pendingEdits = new Map<number, Partial<Task>>([
      [t.id, { description: "Edited" }],
    ]);
    const { events } = tasksToEvents([t], {
      rangeStart: RANGE_START,
      rangeEnd: RANGE_END,
      pendingEdits,
    });
    expect(events[0].title).toBe("Edited");
  });

  it("optimisticUpdates take precedence over pendingEdits", () => {
    const t = createTask(db, userId, {
      description: "Task",
      startAt: "2026-03-05T10:00:00.000Z",
    });
    const pendingEdits = new Map<number, Partial<Task>>([
      [t.id, { startAt: "2026-03-05T09:00:00.000Z" }],
    ]);
    const optimisticUpdates = new Map([
      [t.id, { startAt: "2026-03-05T11:00:00.000Z" }],
    ]);
    const { events } = tasksToEvents([t], {
      rangeStart: RANGE_START,
      rangeEnd: RANGE_END,
      pendingEdits,
      optimisticUpdates,
    });
    expect(events[0].start).toBe("2026-03-05T11:00:00.000Z");
  });

  it("drops tasks marked deleted in optimisticUpdates", () => {
    const t = createTask(db, userId, {
      description: "Doomed",
      startAt: "2026-03-05T10:00:00.000Z",
    });
    const optimisticUpdates = new Map([[t.id, { deleted: true as const }]]);
    const { events } = tasksToEvents([t], {
      rangeStart: RANGE_START,
      rangeEnd: RANGE_END,
      optimisticUpdates,
    });
    expect(events).toHaveLength(0);
  });

  it("drops virtual instances marked deleted in optimisticUpdates", () => {
    const master = createTask(db, userId, {
      description: "Standup",
      startAt: "2026-03-02T14:00:00.000Z",
      endAt: "2026-03-02T15:00:00.000Z",
      recurrence: "FREQ=WEEKLY;BYDAY=MO",
      recurMode: "scheduled",
    });

    const instanceDate = new Date("2026-03-09T14:00:00.000Z");
    const syntheticId = syntheticIdFor(master.id, instanceDate);

    const optimisticUpdates = new Map([
      [syntheticId, { deleted: true as const }],
    ]);
    const { events } = tasksToEvents([master], {
      rangeStart: RANGE_START,
      rangeEnd: RANGE_END,
      optimisticUpdates,
    });
    // 5 expanded - 1 deleted = 4
    expect(events.length).toBe(4);
    expect(events.find((e) => e.id === String(syntheticId))).toBeUndefined();
  });
});

describe("syntheticIdFor", () => {
  it("is deterministic and negative", () => {
    const id1 = syntheticIdFor(42, new Date("2026-03-09T14:00:00.000Z"));
    const id2 = syntheticIdFor(42, new Date("2026-03-09T14:00:00.000Z"));
    expect(id1).toBe(id2);
    expect(id1).toBeLessThan(0);
  });

  it("differs for different masters on the same date", () => {
    const d = new Date("2026-03-09T14:00:00.000Z");
    expect(syntheticIdFor(1, d)).not.toBe(syntheticIdFor(2, d));
  });

  it("differs for the same master on different dates", () => {
    expect(syntheticIdFor(1, new Date("2026-03-09T14:00:00.000Z"))).not.toBe(
      syntheticIdFor(1, new Date("2026-03-16T14:00:00.000Z")),
    );
  });
});
