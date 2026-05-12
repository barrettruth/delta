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
});
