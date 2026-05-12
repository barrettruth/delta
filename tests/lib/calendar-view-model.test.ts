import { beforeEach, describe, expect, it } from "vitest";
import {
  addCalendarDays,
  buildCalendarDraftEvent,
  getCalendarHeaderTitle,
  getCalendarRange,
  isSameCalendarDay,
  mergeOptimisticCalendarTasks,
  pruneOptimisticMasterExdates,
  startOfCalendarDay,
} from "@/components/calendar/calendar-view-model";
import { createTask } from "@/core/task";
import type { Db } from "@/core/types";
import { createTestDb, createTestUser } from "../helpers";

let db: Db;
let userId: number;

beforeEach(() => {
  db = createTestDb();
  userId = createTestUser(db).id;
});

describe("calendar view range and title model", () => {
  it("normalizes and compares focused calendar dates by local day", () => {
    expect(startOfCalendarDay(new Date(2026, 2, 18, 14, 30))).toEqual(
      new Date(2026, 2, 18, 0, 0, 0, 0),
    );
    expect(addCalendarDays(new Date(2026, 2, 18, 14, 30), 7)).toEqual(
      new Date(2026, 2, 25, 0, 0, 0, 0),
    );
    expect(
      isSameCalendarDay(
        new Date(2026, 2, 18, 0, 1),
        new Date(2026, 2, 18, 23, 59),
      ),
    ).toBe(true);
    expect(
      isSameCalendarDay(new Date(2026, 2, 18), new Date(2026, 2, 19)),
    ).toBe(false);
  });

  it("derives a day range from the anchor", () => {
    const anchor = new Date(2026, 2, 18, 14, 30);
    const { start, end } = getCalendarRange({
      visibleRange: null,
      anchor,
      viewMode: "day",
    });

    expect(start).toEqual(new Date(2026, 2, 18, 0, 0, 0, 0));
    expect(end).toEqual(new Date(2026, 2, 19, 0, 0, 0, 0));
  });

  it("uses FullCalendar's visible range when it is available", () => {
    const visibleRange = {
      start: new Date("2026-03-01T00:00:00.000Z"),
      end: new Date("2026-04-01T00:00:00.000Z"),
    };

    expect(
      getCalendarRange({
        visibleRange,
        anchor: new Date(2026, 2, 18),
        viewMode: "week",
      }),
    ).toBe(visibleRange);
  });

  it("formats the header title for the current view mode", () => {
    expect(getCalendarHeaderTitle(new Date(2026, 2, 18, 14), "month")).toBe(
      "March 2026",
    );
  });
});

describe("calendar draft event model", () => {
  it("builds a timed draft event with the default 30 minute duration", () => {
    const startAt = "2026-03-18T14:00:00.000Z";
    const draft = buildCalendarDraftEvent("create", {
      startAt,
      allDay: 0,
    });

    expect(draft?.id).toBe("__draft__");
    expect(draft?.start).toEqual(new Date(startAt));
    expect(draft?.end).toEqual(new Date("2026-03-18T14:30:00.000Z"));
    expect(draft?.allDay).toBe(false);
    expect(draft?.classNames).toContain("is-draft");
  });

  it("builds an all-day draft event with an exclusive next-day end", () => {
    const draft = buildCalendarDraftEvent("create", {
      startAt: "2026-03-18T12:00:00.000Z",
      allDay: 1,
    });

    expect(draft?.allDay).toBe(true);
    expect(draft?.end).toEqual(new Date("2026-03-19T12:00:00.000Z"));
  });

  it("does not render a draft outside create mode", () => {
    expect(
      buildCalendarDraftEvent("edit", {
        startAt: "2026-03-18T14:00:00.000Z",
      }),
    ).toBeNull();
  });
});

describe("calendar optimistic task model", () => {
  it("adds optimistic tasks and patches master exdates without duplicates", () => {
    const master = createTask(db, userId, {
      description: "Weekly",
      startAt: "2026-03-02T14:00:00.000Z",
      exdates: JSON.stringify(["2026-03-09T14:00:00.000Z"]),
    });
    const exception = createTask(db, userId, {
      description: "Materialized weekly",
      startAt: "2026-03-09T14:00:00.000Z",
      recurringTaskId: master.id,
    });

    const result = mergeOptimisticCalendarTasks(
      [master],
      new Map([[exception.id, exception]]),
      new Map([
        [master.id, ["2026-03-09T14:00:00.000Z", "2026-03-16T14:00:00.000Z"]],
      ]),
    );

    const patchedMaster = result.find((task) => task.id === master.id);
    expect(result.find((task) => task.id === exception.id)).toBe(exception);
    expect(JSON.parse(patchedMaster?.exdates ?? "[]")).toEqual([
      "2026-03-09T14:00:00.000Z",
      "2026-03-16T14:00:00.000Z",
    ]);
  });

  it("drops optimistic master exdates once the server task carries them", () => {
    const master = createTask(db, userId, {
      description: "Weekly",
      startAt: "2026-03-02T14:00:00.000Z",
      exdates: JSON.stringify(["2026-03-09T14:00:00.000Z"]),
    });

    const next = pruneOptimisticMasterExdates(
      new Map([
        [master.id, ["2026-03-09T14:00:00.000Z", "2026-03-16T14:00:00.000Z"]],
        [999, ["2026-03-23T14:00:00.000Z"]],
      ]),
      [master],
    );

    expect(next.get(master.id)).toEqual(["2026-03-16T14:00:00.000Z"]);
    expect(next.has(999)).toBe(false);
  });
});
