import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({
  usePathname: () => "/calendar",
  useSearchParams: () => new URLSearchParams("mode=week"),
}));

vi.mock("@/components/calendar/fc-calendar", () => ({
  FcCalendar: () => createElement("div", { "data-slot": "calendar" }),
}));

vi.mock("@/components/calendar/event-popover", () => ({
  CalendarEventPopover: () =>
    createElement("div", { "data-slot": "event-popover" }),
}));

vi.mock("@/components/task-operation-dialogs", () => ({
  TaskOperationDialogs: () =>
    createElement("div", { "data-slot": "task-operation-dialogs" }),
}));

vi.mock("@/components/recurrence-strategy-dialog", () => ({
  RecurrenceStrategyDialog: () =>
    createElement("div", { "data-slot": "recurrence-dialog" }),
}));

vi.mock("@/components/calendar/use-calendar-view-controller", () => ({
  useCalendarViewController: () => ({
    allDaySlotVisible: true,
    anchor: null,
    events: [],
    fcRef: { current: null },
    goNext: () => {},
    goPrev: () => {},
    goTodayWithDismiss: () => {},
    handleDateClick: () => {},
    handleDateSelect: () => {},
    handleDatesSet: () => {},
    handleDayHeaderClick: () => {},
    handleEventDrop: () => {},
    handleEventResize: () => {},
    handleRecurrenceDialogOpenChange: () => {},
    handleRecurrenceStrategySelect: () => {},
    headerTitle: "May 2026",
    openTaskFromEvent: () => {},
    popoverAnchor: null,
    recurrenceEdit: { pending: null },
    taskOperations: { recurrenceDelete: {} },
    viewMode: "week",
  }),
}));

import { CalendarView } from "@/components/calendar-view";

describe("CalendarView", () => {
  it("opens calendar settings from the top-right calendar control", () => {
    const html = renderToStaticMarkup(
      createElement(CalendarView, { tasks: [], defaultViewMode: "week" }),
    );

    expect(html).toContain('aria-label="calendar settings"');
    expect(html).toContain(
      "/settings/calendar?returnTo=%2Fcalendar%3Fmode%3Dweek",
    );
  });
});
