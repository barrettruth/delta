import type { EventContentArg } from "@fullcalendar/core";
import type { DateClickArg } from "@fullcalendar/interaction";
import type { ComponentProps, ReactNode } from "react";
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

class TestDOMRect {
  bottom: number;
  left: number;
  right: number;
  top: number;

  constructor(
    public x = 0,
    public y = 0,
    public width = 0,
    public height = 0,
  ) {
    this.left = x;
    this.top = y;
    this.right = x + width;
    this.bottom = y + height;
  }
}

vi.stubGlobal("DOMRect", TestDOMRect);

function renderCalendar(
  overrides: Partial<ComponentProps<typeof FcCalendar>> = {},
): FullCalendarProps | null {
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
      onDayHeaderClick: () => {},
      onDatesSet: () => {},
      ...overrides,
    }),
  );

  return lastFullCalendarProps;
}

describe("FcCalendar", () => {
  it("lays out timed events side by side instead of visually overlapping", () => {
    const props = renderCalendar();

    expect(props?.slotEventOverlap).toBe(false);
  });

  it("does not attach focused date class hooks", () => {
    const props = renderCalendar();

    expect(props?.dayCellClassNames).toBeUndefined();
    expect(props?.dayHeaderClassNames).toBeUndefined();
  });

  it("does not show FullCalendar's transient selection mirror", () => {
    const props = renderCalendar();

    expect(props?.selectable).toBe(true);
    expect(props?.selectMirror).toBeUndefined();
  });

  it("does not reset manual scroll when the date changes", () => {
    const props = renderCalendar();

    expect(props?.scrollTimeReset).toBe(false);
  });

  it("anchors date clicks to the pointer position", () => {
    const onDateClick = vi.fn();
    const props = renderCalendar({ onDateClick });
    const dateClick = props?.dateClick as ((arg: DateClickArg) => void) | null;
    const date = new Date(2026, 4, 14, 2);

    dateClick?.({
      date,
      allDay: false,
      dayEl: {} as HTMLElement,
      jsEvent: { clientX: 123, clientY: 456 },
    } as unknown as DateClickArg);

    expect(onDateClick).toHaveBeenCalledWith(
      date,
      false,
      expect.objectContaining({
        x: 123,
        y: 456,
        width: 0,
        height: 0,
      }),
    );
  });

  it("anchors touch date clicks from changed touches", () => {
    const onDateClick = vi.fn();
    const props = renderCalendar({ onDateClick });
    const dateClick = props?.dateClick as ((arg: DateClickArg) => void) | null;
    const date = new Date(2026, 4, 14, 2);

    dateClick?.({
      date,
      allDay: false,
      dayEl: {} as HTMLElement,
      jsEvent: {
        touches: [],
        changedTouches: [{ clientX: 321, clientY: 654 }],
      },
    } as unknown as DateClickArg);

    expect(onDateClick).toHaveBeenCalledWith(
      date,
      false,
      expect.objectContaining({
        x: 321,
        y: 654,
        width: 0,
        height: 0,
      }),
    );
  });

  it("exposes week day headers as day-view navigation links", () => {
    const onDayHeaderClick = vi.fn();
    const props = renderCalendar({ onDayHeaderClick });
    const navLinkDayClick = props?.navLinkDayClick as
      | ((date: Date, event: UIEvent) => void)
      | undefined;
    const date = new Date(2026, 4, 14);

    expect(props?.navLinks).toBe(true);
    navLinkDayClick?.(date, {} as UIEvent);
    expect(onDayHeaderClick).toHaveBeenCalledWith(date);
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
