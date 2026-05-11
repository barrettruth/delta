import { describe, expect, it } from "vitest";
import { hasAllDayEventInRange } from "@/lib/fullcalendar-adapter";

describe("hasAllDayEventInRange", () => {
  const rangeStart = new Date(2026, 2, 10);
  const rangeEnd = new Date(2026, 2, 11);

  it("detects all-day events in the visible range", () => {
    expect(
      hasAllDayEventInRange(
        [{ title: "Holiday", start: "2026-03-10", allDay: true }],
        rangeStart,
        rangeEnd,
      ),
    ).toBe(true);
  });

  it("ignores timed events", () => {
    expect(
      hasAllDayEventInRange(
        [
          {
            title: "Meeting",
            start: "2026-03-10T13:00:00.000Z",
            allDay: false,
          },
        ],
        rangeStart,
        rangeEnd,
      ),
    ).toBe(false);
  });

  it("treats an all-day event without an end as one local day", () => {
    expect(
      hasAllDayEventInRange(
        [{ title: "Yesterday", start: "2026-03-09", allDay: true }],
        rangeStart,
        rangeEnd,
      ),
    ).toBe(false);
  });

  it("uses exclusive end dates for all-day ranges", () => {
    expect(
      hasAllDayEventInRange(
        [
          {
            title: "Previous range",
            start: "2026-03-09",
            end: "2026-03-10",
            allDay: true,
          },
        ],
        rangeStart,
        rangeEnd,
      ),
    ).toBe(false);
  });
});
