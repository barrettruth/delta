import type { EventContentArg } from "@fullcalendar/core";
import type { ReactNode } from "react";
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

  it("marks elapsed events for past styling", () => {
    const props = renderCalendar();
    const eventClassNames = props?.eventClassNames as
      | ((arg: EventContentArg) => string[])
      | undefined;

    expect(
      eventClassNames?.({ isPast: true } as unknown as EventContentArg),
    ).toEqual(["is-elapsed"]);
    expect(
      eventClassNames?.({ isPast: false } as unknown as EventContentArg),
    ).toEqual([]);
  });

  it("puts custom event chrome on the owned content wrapper", () => {
    const props = renderCalendar();
    const eventContent = props?.eventContent as
      | ((arg: EventContentArg) => ReactNode)
      | undefined;

    const html = renderToStaticMarkup(
      createElement(
        "div",
        null,
        eventContent?.({
          borderColor: "#3788d8",
          event: {
            title: "Drag me",
            extendedProps: {
              calendarBorderColor: "#0f766e",
            },
          },
          timeText: "14:30 - 15:00",
        } as unknown as EventContentArg),
      ),
    );

    expect(html).toContain("fc-delta-event-inner");
    expect(html).toContain("--delta-calendar-event-border:#0f766e");
  });
});
