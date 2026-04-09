import { describe, expect, it } from "vitest";
import {
  buildDayPreFill,
  buildSlotPreFill,
  getCreatePreview,
} from "@/lib/calendar-utils";

describe("buildSlotPreFill", () => {
  it("snaps to nearest 15 minutes", () => {
    const date = new Date(2026, 2, 25);
    const result = buildSlotPreFill(date, 137);
    const start = new Date(result.startAt!);
    expect(start.getHours()).toBe(2);
    expect(start.getMinutes()).toBe(15);
  });

  it("sets allDay to 0", () => {
    const date = new Date(2026, 2, 25);
    const result = buildSlotPreFill(date, 60);
    expect(result.allDay).toBe(0);
  });

  it("sets due equal to startAt", () => {
    const date = new Date(2026, 2, 25);
    const result = buildSlotPreFill(date, 540);
    expect(result.due).toBe(result.startAt);
  });

  it("does not set endAt", () => {
    const date = new Date(2026, 2, 25);
    const result = buildSlotPreFill(date, 600);
    expect(result.endAt).toBeUndefined();
  });

  it("sets timezone", () => {
    const date = new Date(2026, 2, 25);
    const result = buildSlotPreFill(date, 0);
    expect(result.timezone).toBeTruthy();
  });

  it("handles midnight (0 minutes)", () => {
    const date = new Date(2026, 2, 25);
    const result = buildSlotPreFill(date, 0);
    const start = new Date(result.startAt!);
    expect(start.getHours()).toBe(0);
    expect(start.getMinutes()).toBe(0);
  });

  it("handles 23:45 slot", () => {
    const date = new Date(2026, 2, 25);
    const result = buildSlotPreFill(date, 23 * 60 + 45);
    const start = new Date(result.startAt!);
    expect(start.getHours()).toBe(23);
    expect(start.getMinutes()).toBe(45);
  });

  it("snaps 7 minutes to 0", () => {
    const date = new Date(2026, 2, 25);
    const result = buildSlotPreFill(date, 7);
    const start = new Date(result.startAt!);
    expect(start.getMinutes()).toBe(0);
  });

  it("snaps 8 minutes to 15", () => {
    const date = new Date(2026, 2, 25);
    const result = buildSlotPreFill(date, 8);
    const start = new Date(result.startAt!);
    expect(start.getMinutes()).toBe(15);
  });
});

describe("buildDayPreFill", () => {
  it("sets allDay to 1", () => {
    const date = new Date(2026, 2, 25);
    const result = buildDayPreFill(date);
    expect(result.allDay).toBe(1);
  });

  it("sets due to noon of the given date", () => {
    const date = new Date(2026, 2, 25);
    const result = buildDayPreFill(date);
    const due = new Date(result.due!);
    expect(due.getFullYear()).toBe(2026);
    expect(due.getMonth()).toBe(2);
    expect(due.getDate()).toBe(25);
    expect(due.getHours()).toBe(12);
    expect(due.getMinutes()).toBe(0);
  });

  it("sets startAt to noon but not endAt", () => {
    const date = new Date(2026, 2, 25);
    const result = buildDayPreFill(date);
    expect(result.startAt).toBeDefined();
    expect(new Date(result.startAt!).getHours()).toBe(12);
    expect(result.endAt).toBeUndefined();
  });

  it("sets timezone", () => {
    const date = new Date(2026, 2, 25);
    const result = buildDayPreFill(date);
    expect(result.timezone).toBeTruthy();
  });
});

describe("getCreatePreview", () => {
  it("defaults single-click previews to 15 minutes", () => {
    const weekAnchor = new Date(2026, 2, 22);
    const preFill = buildSlotPreFill(new Date(2026, 2, 25), 10 * 60 + 30);

    expect(getCreatePreview(preFill, weekAnchor)).toEqual({
      dayIndex: 3,
      startMin: 630,
      endMin: 645,
    });
  });

  it("uses the explicit end time for range-created previews", () => {
    const weekAnchor = new Date(2026, 2, 22);
    const date = new Date(2026, 2, 24);
    const startAt = new Date(date);
    startAt.setHours(9, 0, 0, 0);
    const endAt = new Date(date);
    endAt.setHours(11, 0, 0, 0);
    const preFill = {
      startAt: startAt.toISOString(),
      endAt: endAt.toISOString(),
      allDay: 0,
    };

    expect(getCreatePreview(preFill, weekAnchor)).toEqual({
      dayIndex: 2,
      startMin: 540,
      endMin: 660,
    });
  });
});
