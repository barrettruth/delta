import { describe, expect, it } from "vitest";
import {
  getNextOccurrence,
  getNextTaskData,
  parseRRule,
} from "@/core/recurrence";
import type { Task } from "@/core/types";

describe("parseRRule", () => {
  it("parses a basic RRULE string", () => {
    const rule = parseRRule("FREQ=WEEKLY;BYDAY=MO");
    expect(rule).toBeDefined();
  });

  it("strips RRULE: prefix", () => {
    const rule = parseRRule("RRULE:FREQ=DAILY");
    expect(rule).toBeDefined();
  });
});

describe("getNextOccurrence", () => {
  it("scheduled: returns next weekly occurrence after due date", () => {
    const next = getNextOccurrence(
      "FREQ=WEEKLY",
      "scheduled",
      "2026-03-15T09:00:00.000Z",
      "2026-03-16T15:00:00.000Z",
    );
    expect(next).not.toBeNull();
    expect(next?.getTime()).toBeGreaterThan(
      new Date("2026-03-15T09:00:00.000Z").getTime(),
    );
  });

  it("scheduled: uses completedAt as reference when no due date", () => {
    const next = getNextOccurrence(
      "FREQ=DAILY",
      "scheduled",
      null,
      "2026-03-22T12:00:00.000Z",
    );
    expect(next).not.toBeNull();
    expect(next?.getTime()).toBeGreaterThan(
      new Date("2026-03-22T12:00:00.000Z").getTime(),
    );
  });

  it("completion: returns next occurrence relative to completion", () => {
    const next = getNextOccurrence(
      "FREQ=WEEKLY",
      "completion",
      "2026-03-22T09:00:00.000Z",
      "2026-03-25T14:00:00.000Z",
    );
    expect(next).not.toBeNull();
    expect(next?.getTime()).toBeGreaterThan(
      new Date("2026-03-25T14:00:00.000Z").getTime(),
    );
  });
});

describe("getNextTaskData", () => {
  const baseTask: Task = {
    id: 1,
    userId: 1,
    description: "Weekly review",
    status: "done",
    category: "Work",
    label: null,
    startAt: null,
    endAt: null,
    allDay: 0,
    timezone: null,
    due: "2026-03-22T09:00:00.000Z",
    recurrence: "FREQ=WEEKLY",
    recurMode: "scheduled",
    notes: "Check PRs",
    order: 1,
    createdAt: "2026-03-22T08:00:00.000Z",
    updatedAt: "2026-03-22T15:00:00.000Z",
    completedAt: "2026-03-22T15:00:00.000Z",
    location: null,
    meetingUrl: null,
  };

  it("returns null for non-recurring task", () => {
    expect(getNextTaskData({ ...baseTask, recurrence: null })).toBeNull();
  });

  it("returns null when completedAt is missing", () => {
    expect(getNextTaskData({ ...baseTask, completedAt: null })).toBeNull();
  });

  it("returns new task data for recurring task", () => {
    const data = getNextTaskData(baseTask);
    expect(data).not.toBeNull();
    expect(data?.description).toBe("Weekly review");
    expect(data?.category).toBe("Work");
    expect(data?.recurrence).toBe("FREQ=WEEKLY");
    expect(data?.recurMode).toBe("scheduled");
    expect(data?.notes).toBe("Check PRs");
    expect(data?.due).toBeTruthy();
    expect(new Date(data?.due ?? "").getTime()).toBeGreaterThan(
      new Date("2026-03-22T09:00:00.000Z").getTime(),
    );
  });

  it("defaults recurMode to scheduled when null", () => {
    const data = getNextTaskData({ ...baseTask, recurMode: null });
    expect(data).not.toBeNull();
    expect(data?.recurMode).toBe("scheduled");
  });
});
