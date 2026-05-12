import { createElement, forwardRef } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

type FullCalendarProps = Record<string, unknown>;

let lastFullCalendarProps: FullCalendarProps | null = null;

vi.mock("@fullcalendar/react", () => {
  const MockFullCalendar = forwardRef<unknown, FullCalendarProps>(
    (props, _ref) => {
      lastFullCalendarProps = props;
      return createElement("div", { "data-slot": "fullcalendar" });
    },
  );
  MockFullCalendar.displayName = "MockFullCalendar";

  return { default: MockFullCalendar };
});

vi.mock("@fullcalendar/daygrid", () => ({ default: { name: "dayGrid" } }));
vi.mock("@fullcalendar/interaction", () => ({
  default: { name: "interaction" },
}));
vi.mock("@fullcalendar/timegrid", () => ({ default: { name: "timeGrid" } }));

import { FcCalendar } from "@/components/calendar/fc-calendar";

function renderCalendar(): FullCalendarProps | null {
  lastFullCalendarProps = null;

  renderToStaticMarkup(
    createElement(FcCalendar, {
      events: [],
      viewMode: "week",
      initialDate: new Date("2026-05-12T12:00:00Z"),
      focusedDate: new Date(2026, 4, 12, 14, 30),
      allDaySlot: true,
      onEventClick: () => {},
      onEventDrop: () => {},
      onEventResize: () => {},
      onDateSelect: () => {},
      onDateClick: () => {},
      onDatesSet: () => {},
    }),
  );

  return lastFullCalendarProps;
}

describe("FcCalendar", () => {
  it("lays out timed events side by side instead of visually overlapping", () => {
    const props = renderCalendar();

    expect(props?.slotEventOverlap).toBe(false);
  });

  it("marks the focused date in cells and headers", () => {
    const props = renderCalendar();
    const cellClassNames = props?.dayCellClassNames as
      | ((arg: { date: Date }) => string[])
      | undefined;
    const headerClassNames = props?.dayHeaderClassNames as
      | ((arg: { date: Date }) => string[])
      | undefined;

    expect(cellClassNames?.({ date: new Date(2026, 4, 12, 8) })).toEqual([
      "fc-delta-focused-date",
    ]);
    expect(headerClassNames?.({ date: new Date(2026, 4, 12, 8) })).toEqual([
      "fc-delta-focused-date-header",
    ]);
    expect(cellClassNames?.({ date: new Date(2026, 4, 13, 8) })).toEqual([]);
    expect(headerClassNames?.({ date: new Date(2026, 4, 13, 8) })).toEqual([]);
  });
});
